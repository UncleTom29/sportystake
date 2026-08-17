/**
 * Oracle → Postgres write-through worker.
 *
 * Subscribes to four Redis channels the oracle publishes on:
 *   - `market:sync`      — full snapshot of every prematch fixture currently
 *                          on 1xbet (single-provider). When `isFullSync` is
 *                          true, sweeps stale markets that aren't in the
 *                          snapshot (skipping any with open bets / LP positions).
 *   - `market:live`      — minute/score tick on a single live fixture
 *   - `market:finished`  — fixture has wrapped up
 *   - `odds:update`      — full markets bundle for a fixture (all market types
 *                          replaced atomically per `(market, bookmaker)`).
 *
 * Run it:
 *   `npx tsx src/workers/oracle-sync.worker.ts`
 */
// Env is loaded via Node's `--env-file=.env` flag (see package.json scripts).
import { keccak256, encodePacked } from "viem";
import { redisSubscriber } from "@/lib/server/redis";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { syncPolymarketMarkets, settleResolvedPolymarketMarkets } from "@/lib/server/polymarket";
import { cancelMarketOnchain } from "@/lib/server/settlement";
import { verifyOperatorRoles } from "@/lib/server/operatorWallet";
import { clientEnv } from "@/lib/env";

const C_SYNC = "market:sync";
const C_LIVE = "market:live";
const C_FINISHED = "market:finished";
const C_ODDS = "odds:update";
const POLYMARKET_SYNC_MS = 5 * 60_000;
const PRUNE_CLOSED_MS = 30 * 60_000;

interface NormalizedFixture {
  fixtureId: number;
  externalId: string;
  sport?: string;
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  country: string;
  countryCode: string | null;
  season: number;
  round: string;
  homeTeam: string; homeTeamId: number; homeTeamLogo: string;
  awayTeam: string; awayTeamId: number; awayTeamLogo: string;
  startTime: string;
  status: "OPEN" | "LIVE" | "FINISHED" | "CANCELLED";
  rawStatus: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  venue: string | null;
}

interface SyncEvent {
  type: "fixtures:synced";
  isFullSync?: boolean;
  fixtures: NormalizedFixture[];
}

interface LiveEvent {
  type: "market:live";
  fixture: NormalizedFixture;
}

interface FinishedEvent {
  type: "market:finished";
  fixtureId: number;
  homeScore: number;
  awayScore: number;
}

interface OddsEvent {
  type: "odds:updated";
  fixtureId: number;
  bookmaker?: string;
  markets: Array<{
    market: string;
    outcomes: Array<{ key: string; label: string; decimal: number; valueX1000: number }>;
  }>;
}

function marketIdFor(fixtureId: number, marketType = "1X2"): `0x${string}` {
  // Mirrors the on-chain derivation used by the SDK.
  return keccak256(encodePacked(["uint256", "string"], [BigInt(fixtureId), marketType]));
}

function statusFor(f: NormalizedFixture): "OPEN" | "LIVE" | "SETTLED" | "CANCELLED" {
  if (f.status === "FINISHED") return "SETTLED";
  if (f.status === "LIVE") return "LIVE";
  if (f.status === "CANCELLED") return "CANCELLED";
  return "OPEN";
}

/** Upserts one fixture into Postgres — creates the Market row if this is the
 *  first time we've seen this fixtureId, updates it otherwise. Shared by the
 *  prematch snapshot path and the live-tick path: a fixture can go live
 *  without ever appearing in a prematch snapshot first, so live ticks need
 *  the same create-or-update power, not a blind update. */
async function upsertFixture(f: NormalizedFixture): Promise<void> {
  const id = marketIdFor(f.fixtureId);
  const start = new Date(f.startTime);
  // Markets close 1 minute before kickoff by default.
  const closesAt = new Date(start.getTime() - 60_000);
  await MarketsRepo.upsertFromOracle({
    id,
    externalId: f.externalId,
    fixtureId: f.fixtureId,
    sport: f.sport ?? 'football',
    leagueId: f.leagueId,
    leagueName: f.leagueName,
    leagueLogo: f.leagueLogo,
    country: f.country,
    ...(f.countryCode ? { countryCode: f.countryCode } : {}),
    season: f.season,
    round: f.round,
    homeTeam: f.homeTeam, homeTeamId: f.homeTeamId, homeTeamLogo: f.homeTeamLogo,
    awayTeam: f.awayTeam, awayTeamId: f.awayTeamId, awayTeamLogo: f.awayTeamLogo,
    startTime: start,
    closesAt,
    status: statusFor(f),
    ...(f.homeScore !== undefined ? { homeScore: f.homeScore } : {}),
    ...(f.awayScore !== undefined ? { awayScore: f.awayScore } : {}),
    ...(f.minute !== null ? { liveMinute: f.minute } : {}),
  });
}

async function handleSync(evt: SyncEvent): Promise<void> {
  const fixtures = evt.fixtures ?? [];
  let skipped = 0;
  let upserted = 0;
  const seenExternalIds = new Set<string>();
  for (const f of fixtures) {
    // Legacy odds-api fixtures (no scraped odds) should never have been written.
    if (f.externalId?.startsWith('oddsapi:')) {
      skipped++;
      continue;
    }
    seenExternalIds.add(f.externalId);
    await upsertFixture(f);
    upserted++;
  }
  console.log(`[oracle-sync] synced ${upserted} fixtures (skipped ${skipped} legacy)`);

  // Mark-and-sweep: when the payload is the full current snapshot, delete any
  // OPEN/SUSPENDED sports market that isn't in it AND has no user money on it.
  // Markets with bets or parlay legs are preserved (the settlement worker
  // resolves them via livescore polling). LP positions no longer factor in —
  // the shared LiquidityPool isn't scoped to any one market.
  if (evt.isFullSync && seenExternalIds.size > 0) {
    await sweepUnseenMarkets(seenExternalIds);
  }
}

async function sweepUnseenMarkets(seenExternalIds: Set<string>): Promise<void> {
  try {
    const result = await prisma.market.deleteMany({
      where: {
        sport: { not: "prediction-markets" },
        status: { in: ["OPEN", "SUSPENDED"] },
        externalId: { notIn: Array.from(seenExternalIds) },
        // Default Prisma relation filter — no record on any of these.
        bets:        { none: {} },
        parlayLegs:  { none: {} },
      },
    });
    if (result.count > 0) {
      console.log(`[oracle-sync] swept ${result.count} unseen markets (no bets/LPs)`);
    }
  } catch (error) {
    console.error("[oracle-sync] sweep error", error);
  }
}

async function handleLive(evt: LiveEvent): Promise<void> {
  // Full upsert, not updateMany: a fixture that's already in-play the first
  // time we see it (never appeared in a prematch snapshot) has no row to
  // update yet, and updateMany would silently match zero rows forever.
  await upsertFixture(evt.fixture);
}

async function handleFinished(evt: FinishedEvent): Promise<void> {
  const id = marketIdFor(evt.fixtureId);
  await prisma.market.updateMany({
    where: { id },
    data: { status: "SETTLED", homeScore: evt.homeScore, awayScore: evt.awayScore },
  });
}

async function handleOdds(evt: OddsEvent): Promise<void> {
  // One Postgres Market row covers all market types for a fixture — find it
  // by fixtureId, not by a per-market-type derived id.
  const market = await prisma.market.findUnique({
    where: { fixtureId: BigInt(evt.fixtureId) },
    select: { id: true },
  });
  if (!market) return;
  const bookmaker = evt.bookmaker ?? '1xbet';
  const incoming = evt.markets ?? [];

  // Replace every (marketId, bookmaker) snapshot in one transaction. This is
  // O(2) queries per fixture regardless of how many market types we got back
  // — critical when a football event carries 30+ markets (totals at every
  // line, asian handicaps, team totals, …).
  await prisma.$transaction([
    prisma.oddsSnapshot.deleteMany({
      where: { marketId: market.id, bookmaker },
    }),
    prisma.oddsSnapshot.createMany({
      data: incoming.map((m) => ({
        marketId: market.id,
        marketType: m.market,
        bookmaker,
        outcomes: m.outcomes.map((o, i) => ({
          outcome: i, // numeric index — in sync with smart-contract outcome ids
          label: o.label,
          valueX1000: o.valueX1000,
        })),
      })),
    }),
  ]);
}

/**
 * One-time bootstrap: Redis pub/sub doesn't replay history, so if the oracle
 * published `market:sync` before this worker subscribed, we'd never see the
 * data. Pull whatever fixtures are already in the cache and seed Postgres
 * before subscribing to live events. (No mark-and-sweep on seed — that has to
 * wait for the first real publish since cached data may be a stale subset.)
 */
async function seedFromCache(): Promise<void> {
  const { redis } = await import("@/lib/server/redis");
  const r = redis();
  const keys = await r.keys("oracle:fixtures:date:*");
  if (keys.length === 0) {
    console.log("[oracle-sync] no cached fixtures to seed");
    return;
  }
  let total = 0;
  for (const key of keys) {
    const raw = await r.get(key);
    if (!raw) continue;
    const fixtures = JSON.parse(raw);
    if (!Array.isArray(fixtures)) continue;
    await handleSync({ type: "fixtures:synced", fixtures });
    total += fixtures.length;
  }
  console.log(`[oracle-sync] seeded ${total} fixtures from ${keys.length} cached date(s)`);
}

// syncPolymarketMarkets now paginates through Polymarket's full sports
// catalog (see its own doc comment) instead of a single fast page, so a run
// can take a couple of minutes when their API is slow. Guards against a run
// still being in flight when the next POLYMARKET_SYNC_MS tick fires, which
// would otherwise fire a second overlapping wave of requests at an API
// that's already struggling.
let predictionMarketsRefreshInFlight = false;

async function refreshPredictionMarkets(): Promise<void> {
  if (predictionMarketsRefreshInFlight) {
    console.log("[oracle-sync] prediction market refresh still running, skipping this tick");
    return;
  }
  predictionMarketsRefreshInFlight = true;
  try {
    await syncPolymarketMarkets();
    await settleResolvedPolymarketMarkets();
    console.log("[oracle-sync] refreshed prediction markets");
  } catch (error) {
    console.error("[oracle-sync] prediction market refresh error", error);
  } finally {
    predictionMarketsRefreshInFlight = false;
  }
}

async function pruneClosedSportsMarkets(): Promise<void> {
  // Delete markets that are SETTLED/CANCELLED + 6 h past start, that have no
  // open user money on them. We don't try to clean up SETTLED markets with
  // bets either — those rows are needed for bet history + claim flows.
  try {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const result = await prisma.market.deleteMany({
      where: {
        sport: { not: "prediction-markets" },
        status: { in: ["SETTLED", "CANCELLED"] },
        startTime: { lt: cutoff },
        bets:        { none: {} },
        parlayLegs:  { none: {} },
      },
    });
    if (result.count > 0) {
      console.log(`[oracle-sync] pruned ${result.count} closed sports markets`);
    }
  } catch (error) {
    console.error("[oracle-sync] prune closed sports markets error", error);
  }
}

// A market can end up with no possible path to a live/finished signal —
// e.g. one sourced only from a provider the live-poller doesn't cover (see
// XbetLiveJob: it watches exactly one provider's feed, keyed by that
// provider's own fixture-id space, with no cross-provider id mapping) — and
// just sit OPEN forever. First real case: a bettor's football bet stuck
// PENDING for 3 real days because its market (betika-sourced) never once
// received a live tick. Every football match is long over well within this
// window regardless of provider/coverage/scraper-outage cause, so rather
// than chase each individual gap, this is a provider-agnostic backstop:
// cancel (refund) anything that's this stale, whatever broke.
const STUCK_MARKET_CUTOFF_MS = 4 * 60 * 60 * 1000;
const STUCK_MARKET_CHECK_MS = 30 * 60_000;

async function recoverStuckSportsMarkets(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STUCK_MARKET_CUTOFF_MS);
    const stuck = await prisma.market.findMany({
      where: {
        sport: { not: "prediction-markets" },
        status: { in: ["OPEN", "LIVE", "SUSPENDED"] },
        closesAt: { lt: cutoff },
      },
      select: { id: true, homeTeam: true, awayTeam: true, closesAt: true, externalId: true },
    });
    if (stuck.length === 0) return;

    console.warn(
      `[oracle-sync] recovering ${stuck.length} market(s) stuck open >${STUCK_MARKET_CUTOFF_MS / 3_600_000}h past closesAt with no live/finished signal ever received`,
      stuck.map((m) => `${m.homeTeam} vs ${m.awayTeam} (${m.externalId}, closed ${m.closesAt.toISOString()})`),
    );

    for (const market of stuck) {
      try {
        await cancelMarketOnchain(market.id);
        console.log(`[oracle-sync] recovered stuck market ${market.id} (${market.homeTeam} vs ${market.awayTeam})`);
      } catch (error) {
        console.error(`[oracle-sync] failed to recover stuck market ${market.id}`, error);
      }
    }
  } catch (error) {
    console.error("[oracle-sync] recover stuck markets error", error);
  }
}

async function bootstrap(): Promise<void> {
  await verifyOperatorRoles([{ name: "bettingCore", address: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}` }]);
  await seedFromCache();
  await refreshPredictionMarkets();
  await pruneClosedSportsMarkets();
  await recoverStuckSportsMarkets();
  setInterval(() => {
    void refreshPredictionMarkets();
  }, POLYMARKET_SYNC_MS);
  setInterval(() => {
    void pruneClosedSportsMarkets();
  }, PRUNE_CLOSED_MS);
  setInterval(() => {
    void recoverStuckSportsMarkets();
  }, STUCK_MARKET_CHECK_MS);

  const sub = redisSubscriber();
  await sub.subscribe(C_SYNC, C_LIVE, C_FINISHED, C_ODDS);

  async function processMessage(channel: string, raw: string): Promise<void> {
    try {
      const evt = JSON.parse(raw);
      switch (channel) {
        case C_SYNC:     await handleSync(evt as SyncEvent); break;
        case C_LIVE:     await handleLive(evt as LiveEvent); break;
        case C_FINISHED: await handleFinished(evt as FinishedEvent); break;
        case C_ODDS:     await handleOdds(evt as OddsEvent); break;
      }
    } catch (err) {
      console.error(`[oracle-sync] ${channel} error`, err);
    }
  }

  // ioredis emits messages fire-and-forget; without backpressure each tick can
  // open overlapping Prisma queries and exhaust Postgres client limits.
  let queue: Promise<void> = Promise.resolve();
  sub.on("message", (channel, raw) => {
    queue = queue
      .then(() => processMessage(channel, raw))
      .catch((err) => {
        console.error("[oracle-sync] queue error", err);
      });
  });

  console.log(`[oracle-sync] subscribed to ${[C_SYNC, C_LIVE, C_FINISHED, C_ODDS].join(", ")}`);
}

bootstrap().catch((err) => {
  console.error("[oracle-sync] fatal", err);
  process.exit(1);
});
