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
// A bit faster than the oracle's own ~2m live-scrape cadence, so this never
// waits longer than one oracle tick to pick up a change — worst case it
// re-reads the same still-cached snapshot once in between, which is a cheap,
// harmless no-op update.
const LIVE_RECONCILE_MS = 90 * 1000;

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

  // Never overwrite a market that's already been settled or cancelled —
  // a stale live tick (or a finished fixture still appearing in the live
  // feed) must not revert a finalized market's status or scores.
  const existing = await prisma.market.findUnique({
    where: { fixtureId: BigInt(f.fixtureId) },
    select: { status: true },
  });
  if (existing && (existing.status === "SETTLED" || existing.status === "CANCELLED")) {
    return;
  }

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
    ...(statusFor(f) !== "OPEN" && f.homeScore !== undefined ? { homeScore: f.homeScore } : {}),
    ...(statusFor(f) !== "OPEN" && f.awayScore !== undefined ? { awayScore: f.awayScore } : {}),
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
  // Don't overwrite a cancelled market's score — it's already been refunded.
  // SETTLED is allowed here: the settlement worker processes this same event
  // and needs the score present on the Market row for display.
  await prisma.market.updateMany({
    where: { id, status: { notIn: ["CANCELLED"] } },
    data: { homeScore: evt.homeScore, awayScore: evt.awayScore },
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

interface CachedLiveRow {
  match_id: string;
  score: { home: number; away: number };
  minute: number | null;
  finished: boolean;
}

/**
 * Backstop for a real gap: `market:live` is a Redis pub/sub publish, which
 * has no persistence or replay — if this worker isn't actively subscribed
 * at the exact instant a tick fires (a deploy mid-restart, a brief Redis
 * reconnect, any other momentary gap), that tick's score update is gone
 * forever as far as pub/sub is concerned, and Postgres's Market row is
 * stuck showing whatever it last had — 0-0 for a match that hasn't been
 * ticked since before kickoff, potentially for its entire duration if nothing
 * ever nudges it again. Meanwhile `/api/livescores` reads `oracle:live:events`
 * directly — a plain overwrite-on-write cache key, not a stream — so it always
 * reflects the oracle's latest scrape with no possibility of a missed
 * message, which is exactly why the live page can show a correct score for
 * a match whose bet-history/match-detail pages (Postgres-backed) still show
 * 0-0. This reads that exact same authoritative key on an interval and
 * patches Postgres to match, so any pub/sub gap self-heals within one cycle
 * instead of persisting for a match's entire duration.
 *
 * Deliberately narrow: only patches the live-state fields (score, minute,
 * status) on a market that's still OPEN/LIVE/SUSPENDED — never touches one
 * already SETTLED or CANCELLED, so a momentarily-stale cache read can never
 * revive/overwrite a result that's already been finalized through the real
 * finished-detection path.
 */
async function reconcileLiveScoresFromCache(): Promise<void> {
  try {
    const { redis } = await import("@/lib/server/redis");
    const r = redis();
    const raw = await r.get("oracle:live:events");
    if (!raw) return;
    const rows = JSON.parse(raw) as CachedLiveRow[];
    if (!Array.isArray(rows) || rows.length === 0) return;

    let updated = 0;
    for (const row of rows) {
      const fixtureId = Number.parseInt(row.match_id, 10);
      if (!Number.isFinite(fixtureId)) continue;
      
      const result = await prisma.market.updateMany({
        where: {
          fixtureId: BigInt(fixtureId),
          status: { in: ["OPEN", "LIVE", "SUSPENDED"] },
        },
        data: {
          status: "LIVE",
          homeScore: row.score.home,
          awayScore: row.score.away,
          ...(row.minute !== null ? { liveMinute: row.minute } : {}),
        },
      });
      updated += result.count;

      // If this match is actively in-play right now, ensure any parlay legs
      // that were prematurely marked WON/LOST are reverted back to PENDING!
      // Only do this if the market was actually updated (i.e. still in-play,
      // not already SETTLED/CANCELLED) — otherwise we'd undo correct settlements.
      const market = await prisma.market.findUnique({
        where: { fixtureId: BigInt(fixtureId) },
        select: { id: true },
      });
      if (market && result.count > 0) {
        await prisma.parlayLeg.updateMany({
          where: { marketId: market.id, result: { not: "PENDING" } },
          data: { result: "PENDING" },
        });
        const affectedParlays = await prisma.parlay.findMany({
          where: {
            legs: { some: { marketId: market.id } },
            status: { not: "PENDING" },
          },
          select: { id: true },
        });
        if (affectedParlays.length > 0) {
          await prisma.parlay.updateMany({
            where: { id: { in: affectedParlays.map((p) => p.id) } },
            data: { status: "PENDING", settledAt: null },
          });
        }
      }
    }
    if (updated > 0) {
      console.log(`[oracle-sync] live-cache reconciler: refreshed ${updated} market(s) directly from oracle:live:events`);
    }
  } catch (error) {
    console.error("[oracle-sync] live-cache reconciler error", error);
  }
}

/**
 * Automatically reconciles and settles any past-kickoff matches with active bets
 * that have finished and are no longer in the live feed.
 */
async function resolvePastKickoffMatchesWithBets(): Promise<void> {
  try {
    const { findScoreForTeams } = await import("@/lib/server/liveScoreFeed");
    const now = Date.now();
    const footballCutoff = new Date(now - 115 * 60 * 1000); // 115 mins past kickoff (full 90m + halftime + stoppage)
    const esportsCutoff = new Date(now - 30 * 60 * 1000);

    const { redis } = await import("@/lib/server/redis");
    const raw = await redis().get("oracle:live:events");
    const liveFixtureIds = new Set<string>();
    if (raw) {
      try {
        const liveRows = JSON.parse(raw) as Array<{ match_id: string; finished?: boolean }>;
        for (const r of liveRows) {
          if (!r.finished) liveFixtureIds.add(r.match_id);
        }
      } catch {}
    }

    const pastMarkets = await prisma.market.findMany({
      where: {
        sport: { not: "prediction-markets" },
        OR: [
          // Unsettled past kickoff with bets
          {
            status: { in: ["OPEN", "LIVE", "SUSPENDED"] },
            OR: [
              { sport: { in: ["fifa", "esports"] }, startTime: { lt: esportsCutoff } },
              { sport: { notIn: ["fifa", "esports"] }, startTime: { lt: footballCutoff } },
            ],
            AND: [
              {
                OR: [
                  { bets: { some: {} } },
                  { parlayLegs: { some: {} } },
                ],
              },
            ],
          },
          // Or recently settled markets with bets that need score verification
          {
            status: "SETTLED",
            startTime: { gt: new Date(now - 24 * 60 * 60 * 1000) },
            OR: [
              { bets: { some: {} } },
              { parlayLegs: { some: {} } },
            ],
          },
        ],
      },
      include: {
        bets: true,
        parlayLegs: true,
      },
    });

    for (const m of pastMarkets) {
      if (m.fixtureId && liveFixtureIds.has(m.fixtureId.toString())) {
        continue; // Still live in-play
      }

      // Look up authentic score from LiveScore feed
      const liveData = await findScoreForTeams(m.homeTeam, m.awayTeam, m.sport, m.startTime);
      const homeScore = liveData?.homeScore ?? m.homeScore;
      const awayScore = liveData?.awayScore ?? m.awayScore;

      // NEVER default to 0-0 — an unverifiable score must not settle a match.
      // Let the stuck-market canceller (24h) or admin manual-settle handle it.
      if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
        console.warn(`[oracle-sync] Cannot verify score for ${m.homeTeam} vs ${m.awayTeam} (market ${m.id}) — skipping auto-resolution`);
        continue;
      }

      const scoreChanged = m.homeScore !== homeScore || m.awayScore !== awayScore;
      const statusChanged = m.status !== "SETTLED";

      if (!scoreChanged && !statusChanged) {
        continue;
      }

      console.log(`[oracle-sync] Auto-resolving finished match ${m.id} (${m.homeTeam} vs ${m.awayTeam}) with verified score ${homeScore}-${awayScore}`);

      await prisma.market.update({
        where: { id: m.id },
        data: {
          status: "SETTLED",
          homeScore,
          awayScore,
        },
      });

      const { planScoreBasedSettlement, executeMarketSettlement, resolveScoreBasedOutcome } = await import("@/lib/server/settlement");
      const primaryWinningOutcome = resolveScoreBasedOutcome("1X2", homeScore, awayScore) ?? 0;
      const plan = await planScoreBasedSettlement(m.id, homeScore, awayScore);
      await executeMarketSettlement({
        marketId: m.id,
        primaryWinningOutcome,
        plan,
      });
    }
  } catch (error) {
    console.error("[oracle-sync] resolvePastKickoffMatchesWithBets error", error);
  }
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
// e.g. a fixture the live feed never once picks up (a genuine coverage gap),
// or a fast individual-sport match (table tennis, a short tennis set) that
// starts and finishes between two ~2-minute scrapes, too quick to ever be
// seen live twice — and just sit OPEN forever. This is a provider-agnostic
// backstop for exactly that: cancel (refund) anything this stale, whatever
// broke.
//
// Gated on BOTH closesAt age AND updatedAt age (not closesAt alone) — a
// market still being actively ticked (a long tennis match, extra time, a
const STUCK_EMPTY_MARKET_CUTOFF_MS = 4 * 60 * 60 * 1000;  // 4h for markets with zero bets
const STUCK_BET_MARKET_CUTOFF_MS = 24 * 60 * 60 * 1000;    // 24h for markets with active bets (prevents premature refunds)
const STUCK_MARKET_CHECK_MS = 15 * 60_000;
const STUCK_MARKET_ONCHAIN_BATCH = 20;

async function recoverStuckSportsMarkets(): Promise<void> {
  try {
    const emptyCutoff = new Date(Date.now() - STUCK_EMPTY_MARKET_CUTOFF_MS);
    const betCutoff = new Date(Date.now() - STUCK_BET_MARKET_CUTOFF_MS);

    // 1. Bulk-cancel stale markets that had NO bets placed
    const emptyStuck = await prisma.market.findMany({
      where: {
        sport: { not: "prediction-markets" },
        status: { in: ["OPEN", "LIVE", "SUSPENDED"] },
        closesAt: { lt: emptyCutoff },
        updatedAt: { lt: emptyCutoff },
        bets: { none: {} },
        parlayLegs: { none: {} },
      },
      select: { id: true },
    });

    if (emptyStuck.length > 0) {
      const result = await prisma.market.updateMany({
        where: { id: { in: emptyStuck.map((m) => m.id) } },
        data: { status: "CANCELLED" },
      });
      console.log(`[oracle-sync] bulk-cancelled ${result.count} bet-free stuck market(s), no chain calls needed`);
    }

    // 2. Only refund markets WITH real bets after a 24h safety period
    const withMoney = await prisma.market.findMany({
      where: {
        sport: { not: "prediction-markets" },
        status: { in: ["OPEN", "LIVE", "SUSPENDED"] },
        closesAt: { lt: betCutoff },
        updatedAt: { lt: betCutoff },
        OR: [
          { bets: { some: {} } },
          { parlayLegs: { some: {} } },
        ],
      },
      select: {
        id: true, homeTeam: true, awayTeam: true, closesAt: true, externalId: true,
      },
      take: STUCK_MARKET_ONCHAIN_BATCH,
    });

    if (withMoney.length > 0) {
      console.warn(
        `[oracle-sync] refunding ${withMoney.length} market(s) stuck open >24h with active bets:`,
      );
      for (const market of withMoney) {
        try {
          await cancelMarketOnchain(market.id);
          console.log(`[oracle-sync] refunded stuck market ${market.id} (${market.homeTeam} vs ${market.awayTeam})`);
        } catch (error) {
          console.error(`[oracle-sync] failed to recover stuck market ${market.id}`, error);
        }
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
  await reconcileLiveScoresFromCache();
  await resolvePastKickoffMatchesWithBets();
  setInterval(() => {
    void refreshPredictionMarkets();
  }, POLYMARKET_SYNC_MS);
  setInterval(() => {
    void pruneClosedSportsMarkets();
  }, PRUNE_CLOSED_MS);
  setInterval(() => {
    void reconcileLiveScoresFromCache();
  }, LIVE_RECONCILE_MS);
  setInterval(() => {
    void resolvePastKickoffMatchesWithBets();
  }, 60_000);
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
