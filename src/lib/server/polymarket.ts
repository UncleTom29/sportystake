import { encodePacked, keccak256 } from "viem";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { planDirectOutcomeSettlement, executeMarketSettlement } from "@/lib/server/settlement";

/**
 * Polymarket's canonical top-level "Sports" tag — confirmed directly against
 * their API (GET /tags/1 -> {label: "Sports", slug: "sports"}), not guessed.
 * Every sport-specific tag (nfl, epl, mlb, ...) is itself tagged with this
 * one too (GET /sports), so filtering on it alone is enough to cover every
 * sport without enumerating leagues.
 */
const SPORTS_TAG_ID = 1;

type PolymarketMarket = {
  id: string;
  question?: string;
  slug?: string;
  description?: string;
  image?: string;
  endDate?: string;
  startDate?: string;
  createdAt?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string;
  volumeNum?: number;
  liquidityNum?: number;
  /** Non-null on a sub-market of a grouped event — the option it represents (a candidate's name, a team, etc). Null/absent on a plain or primary market. */
  groupItemTitle?: string | null;
};

type PolymarketEvent = {
  id: string;
  title?: string;
  slug?: string;
  description?: string;
  image?: string;
  endDate?: string;
  startDate?: string;
  createdAt?: string;
  active?: boolean;
  closed?: boolean;
  volume?: number;
  liquidity?: number;
  /** Polymarket's own flag for "exactly one of this event's sub-markets resolves YES" — the reliable signal for a true multi-outcome market, not a shape guess. */
  negRisk?: boolean;
  markets?: PolymarketMarket[];
};

const POLYMARKET_FIXTURE_OFFSET = 9_000_000_000_000n;

function parseStringArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

function hashToInt(value: string, seed = 1_000_000): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return seed + (Math.abs(hash >>> 0) % 900_000);
}

function toDecimalOdds(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 1.01;
  return Number(Math.max(1.01, 1 / price).toFixed(3));
}

function marketIdFor(fixtureId: bigint): `0x${string}` {
  return keccak256(encodePacked(["uint256", "string"], [fixtureId, "binary"]));
}

function usableSubMarkets(markets: PolymarketMarket[] | undefined): PolymarketMarket[] {
  return (markets ?? []).filter((m) => {
    if (m.active === false || m.closed === true) return false;
    const outcomes = parseStringArray(m.outcomes);
    const prices = parseStringArray(m.outcomePrices);
    return outcomes.length >= 2 && prices.length >= 2;
  });
}

interface ResolvedSelection {
  outcome: number;
  label: string;
  valueX1000: number;
  /** This selection's own Polymarket market id — needed to re-check its price at settlement time. */
  polymarketMarketId: string;
}

/**
 * True N-way market (an event's negRisk sub-markets, each a candidate that
 * either wins or doesn't) — one selection per sub-market, using that
 * sub-market's own "Yes" price as the selection's odds.
 */
function buildGroupedSelections(subMarkets: PolymarketMarket[]): ResolvedSelection[] {
  return subMarkets
    .filter((m) => (m.groupItemTitle ?? "").trim().length > 0)
    .map((m, index) => {
      const prices = parseStringArray(m.outcomePrices).map((v) => Number.parseFloat(v));
      return {
        outcome: index,
        label: m.groupItemTitle!.trim(),
        valueX1000: Math.round(toDecimalOdds(prices[0] ?? 0) * 1000),
        polymarketMarketId: m.id,
      };
    });
}

/** Plain 2-outcome market — the sub-market itself already carries the real outcome pair (Yes/No, or e.g. two team names for a moneyline). */
function buildBinarySelections(market: PolymarketMarket): ResolvedSelection[] {
  const outcomes = parseStringArray(market.outcomes);
  const prices = parseStringArray(market.outcomePrices).map((v) => Number.parseFloat(v));
  if (outcomes.length < 2 || prices.length < 2) return [];
  return outcomes.slice(0, 2).map((label, index) => ({
    outcome: index,
    label,
    valueX1000: Math.round(toDecimalOdds(prices[index] ?? 0) * 1000),
    polymarketMarketId: market.id,
  }));
}

/**
 * Chooses which sub-market represents a non-grouped event's "main" line —
 * the one with no groupItemTitle (a plain moneyline/binary question), or
 * the first usable sub-market if every one of them is itself unlabeled.
 * A sports game event routinely has 20+ sub-markets (moneyline, spread,
 * total, first-inning props, ...) — Polymarket's own multi-market-type
 * system for one event, parallel to but distinct from this app's
 * marketType bundles on one fixture. Importing all of them as their own
 * bundles would need extending prediction markets into that same
 * multi-type shape sports markets already have; only the primary line is
 * synced for now rather than half-building that.
 */
function pickPrimarySubMarket(subMarkets: PolymarketMarket[]): PolymarketMarket | undefined {
  return subMarkets.find((m) => !m.groupItemTitle) ?? subMarkets[0];
}

interface PlannedMarket {
  fixtureId: bigint;
  question: string;
  selections: ResolvedSelection[];
  marketType: "binary" | "multi_outcome";
}

function planMarketFromEvent(event: PolymarketEvent): PlannedMarket | null {
  if (!event.id || !event.title) return null;
  const subMarkets = usableSubMarkets(event.markets);
  if (subMarkets.length === 0) return null;

  const fixtureId = POLYMARKET_FIXTURE_OFFSET + BigInt(event.id);

  if (event.negRisk && subMarkets.length > 1) {
    const selections = buildGroupedSelections(subMarkets);
    if (selections.length >= 2) {
      return { fixtureId, question: event.title.trim(), selections, marketType: "multi_outcome" };
    }
  }

  const primary = pickPrimarySubMarket(subMarkets);
  if (!primary) return null;
  const selections = buildBinarySelections(primary);
  if (selections.length < 2) return null;
  const question = (primary.question ?? event.title).trim();
  return { fixtureId, question, selections, marketType: "binary" };
}

/**
 * Auto-settle platform markets whose Polymarket counterpart has resolved.
 *
 * This used to only ever update Postgres — never BettingCore.settleMarket
 * on-chain, and never touched any Bet row. Since prediction markets are
 * "native markets" placed through the same on-chain BettingCore as sports
 * bets, that left every prediction-market bet's on-chain status stuck at
 * Pending forever: claimWinnings needs Won (only settleMarket sets that),
 * claimRefund needs the *market* Cancelled (this never cancels it either).
 * A real bet on a prediction market was unclaimable no matter which way it
 * resolved. Now routes through the same executeMarketSettlement as sports.
 */
export async function settleResolvedPolymarketMarkets(limit = 50): Promise<void> {
  const response = await fetch(
    `https://gamma-api.polymarket.com/events?closed=true&tag_id=${SPORTS_TAG_ID}&limit=${limit}&order=endDate&ascending=false`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) return;

  const payload = (await response.json()) as PolymarketEvent[];
  const events = Array.isArray(payload) ? payload : [];

  for (const event of events) {
    if (!event.id) continue;
    const externalId = `polymarket:event:${event.id}`;
    const row = await prisma.market.findUnique({
      where: { externalId },
      select: { id: true, status: true },
    });
    if (!row || row.status === "SETTLED" || row.status === "CANCELLED") continue;

    const subMarkets = event.markets ?? [];
    const isGrouped = !!event.negRisk && subMarkets.filter((m) => m.groupItemTitle).length > 1;

    let winnerIndex = -1;
    if (isGrouped) {
      const labeled = subMarkets.filter((m) => (m.groupItemTitle ?? "").trim().length > 0);
      winnerIndex = labeled.findIndex((m) => {
        const prices = parseStringArray(m.outcomePrices).map((v) => Number.parseFloat(v));
        return prices[0] >= 0.99;
      });
    } else {
      const primary = pickPrimarySubMarket(usableSubMarkets(subMarkets).length ? usableSubMarkets(subMarkets) : subMarkets);
      const prices = parseStringArray(primary?.outcomePrices).map((v) => Number.parseFloat(v));
      winnerIndex = prices.findIndex((p) => p >= 0.99);
    }
    if (winnerIndex < 0) continue; // not resolved (or resolved 50-50 / ambiguous) — leave for manual review

    const marketType = isGrouped ? "multi_outcome" : "binary";
    const plan = await planDirectOutcomeSettlement(row.id, marketType, winnerIndex);
    await executeMarketSettlement({ marketId: row.id, primaryWinningOutcome: winnerIndex, plan });
  }
}

async function upsertPlannedEvent(event: PolymarketEvent, planned: PlannedMarket): Promise<void> {
  const { fixtureId, question, selections, marketType } = planned;
  const leagueName = event.title?.trim() || "Prediction Markets";
  const startTime = new Date(event.startDate ?? event.createdAt ?? Date.now());
  const closesAt = new Date(event.endDate ?? startTime);
  const externalId = `polymarket:event:${event.id}`;
  const id = marketIdFor(fixtureId);

  await MarketsRepo.upsertFromOracle({
    id,
    externalId,
    fixtureId,
    sport: "prediction-markets",
    leagueId: hashToInt(leagueName, 8_000_000),
    leagueName,
    country: "Prediction Markets",
    countryCode: "PM",
    season: closesAt.getUTCFullYear(),
    round: event.slug ?? "polymarket",
    homeTeam: question,
    homeTeamId: 1,
    awayTeam: marketType === "binary" ? "Binary Outcome" : "Multi-outcome",
    awayTeamId: 2,
    startTime,
    closesAt,
    status: "OPEN",
    metadata: {
      source: "polymarket",
      question,
      description: event.description ?? null,
      slug: event.slug ?? null,
      image: event.image ?? null,
      marketType,
      endDate: event.endDate ?? closesAt.toISOString(),
      externalUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : "https://polymarket.com",
      outcomes: selections.map((s) => s.label),
      // Index-aligned with `outcomes` above — needed at settlement time to
      // re-check each selection's own current price.
      subMarketIds: selections.map((s) => s.polymarketMarketId),
      volume: event.volume ?? null,
      liquidity: event.liquidity ?? null,
    },
  });

  const snapshotOutcomes = selections.map(({ outcome, label, valueX1000 }) => ({ outcome, label, valueX1000 }));
  const latest = await prisma.oddsSnapshot.findFirst({
    where: { marketId: id, marketType },
    orderBy: { capturedAt: "desc" },
    select: { outcomes: true },
  });
  const previous = JSON.stringify(latest?.outcomes ?? null);
  const next = JSON.stringify(snapshotOutcomes);
  if (previous === next) return;

  await MarketsRepo.insertOddsSnapshot({
    marketId: id,
    marketType,
    bookmaker: "Polymarket",
    outcomes: snapshotOutcomes,
  });
}

const EVENTS_PAGE_SIZE = 100; // Polymarket's own hard per-request ceiling — confirmed empirically, `limit` above this returns 100 regardless.
const MAX_EVENT_PAGES = 8; // Safety valve against an unbounded loop, not a content cap — see comment below. 8 * 100 = 800 events of headroom over the ~300 currently live.
const PAGE_FETCH_TIMEOUT_MS = 45_000; // This API has been observed taking >60s on a single page; fail fast and keep prior pages rather than hang the whole sync.

/**
 * Only called from oracle-sync.worker.ts's recurring interval now — it used
 * to also run inline on every /prediction-markets page load, but fetching
 * even one page of events with their full nested sub-markets is genuinely
 * slow (empirically: a single limit=100 page has taken anywhere from ~15s to
 * 60s+), which has no business being on a request's critical path. The page
 * now just reads whatever this has already synced into Postgres, which stays
 * fresh on its own 5-minute cadence (POLYMARKET_SYNC_MS) — a filtered
 * Postgres read is fast regardless of row count.
 *
 * Polymarket's `/events` endpoint caps out at 100 results per request no
 * matter what `limit` is passed (confirmed empirically), and there are
 * currently 300+ active events under the sports tag — so covering all of
 * them means paginating via `offset`, not raising `limit`. This walks pages
 * until either a page comes back short (natural end of data) or
 * MAX_EVENT_PAGES is hit — a generous ceiling to stop a pathological loop
 * (e.g. the API always returning exactly 100), not a deliberate content cap.
 * Events are upserted page-by-page as they're fetched, so a slow/failed page
 * later in the walk still leaves everything fetched so far persisted.
 */
export async function syncPolymarketMarkets(maxEvents = MAX_EVENT_PAGES * EVENTS_PAGE_SIZE): Promise<void> {
  for (let page = 0; page * EVENTS_PAGE_SIZE < maxEvents && page < MAX_EVENT_PAGES; page += 1) {
    const offset = page * EVENTS_PAGE_SIZE;
    let response: Response;
    try {
      response = await fetch(
        `https://gamma-api.polymarket.com/events?active=true&closed=false&tag_id=${SPORTS_TAG_ID}&limit=${EVENTS_PAGE_SIZE}&offset=${offset}&order=volume24hr&ascending=false`,
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS) },
      );
    } catch (error) {
      console.error(`[polymarket] events page at offset ${offset} failed, stopping walk`, error);
      return;
    }
    if (!response.ok) return;

    const payload = (await response.json()) as PolymarketEvent[];
    const events = Array.isArray(payload) ? payload : [];

    for (const event of events) {
      const planned = planMarketFromEvent(event);
      if (!planned) continue;
      await upsertPlannedEvent(event, planned);
    }

    if (events.length < EVENTS_PAGE_SIZE) return; // short page = no more data
  }
}
