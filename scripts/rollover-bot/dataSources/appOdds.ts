import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import type { CandidateMarket } from "../types";

/**
 * Pulls every OPEN market across all sports starting within `windowHours`,
 * and derives a per-outcome cross-bookmaker price spread — the widest gap
 * between the best and worst quoted decimal odds for that outcome. A wide
 * spread means bookmakers disagree on the true probability, which is the
 * closest thing to a hard "edge" signal we can compute deterministically
 * (as opposed to the LLM's qualitative read).
 */
export async function fetchCandidateMarkets(windowHours: number): Promise<CandidateMarket[]> {
  const now = Date.now();
  const cutoff = now + windowHours * 60 * 60 * 1000;

  const { items } = await MarketsRepo.list({ status: "OPEN", limit: 500 });

  const candidates: CandidateMarket[] = [];
  for (const m of items) {
    const start = Date.parse(m.startTime);
    const closes = Date.parse(m.closesAt);
    if (!Number.isFinite(start) || start <= now || start > cutoff) continue;
    if (!Number.isFinite(closes) || closes <= now) continue;

    // Group bookmaker quotes by (marketType, outcome) to compute the spread.
    const byOutcome = new Map<
      string,
      { marketType: string; outcome: number; label: string; prices: { bookmaker: string; decimal: number }[] }
    >();
    for (const bk of m.bookmakerOdds) {
      for (const sel of bk.selections) {
        const key = `${bk.marketType}:${sel.outcome}`;
        const decimal = sel.valueX1000 / 1000;
        if (!Number.isFinite(decimal) || decimal <= 1) continue;
        const entry = byOutcome.get(key) ?? {
          marketType: bk.marketType,
          outcome: sel.outcome,
          label: sel.label,
          prices: [],
        };
        entry.prices.push({ bookmaker: bk.bookmaker, decimal });
        byOutcome.set(key, entry);
      }
    }

    // Fall back to the single best-snapshot bundle (m.odds) if no per-bookmaker
    // data was captured for this market yet.
    if (byOutcome.size === 0) {
      for (const bundle of m.odds) {
        for (const sel of bundle.selections) {
          const decimal = sel.valueX1000 / 1000;
          if (!Number.isFinite(decimal) || decimal <= 1) continue;
          byOutcome.set(`${bundle.marketType}:${sel.outcome}`, {
            marketType: bundle.marketType,
            outcome: sel.outcome,
            label: sel.label,
            prices: [{ bookmaker: "unknown", decimal }],
          });
        }
      }
    }

    const outcomes = Array.from(byOutcome.values()).map((entry) => {
      const best = entry.prices.reduce((a, b) => (b.decimal > a.decimal ? b : a));
      const worst = entry.prices.reduce((a, b) => (b.decimal < a.decimal ? b : a));
      const priceSpreadPct = worst.decimal > 0 ? ((best.decimal - worst.decimal) / worst.decimal) * 100 : 0;
      return {
        marketType: entry.marketType,
        outcome: entry.outcome,
        label: entry.label,
        oddsDecimal: best.decimal,
        bestBookmaker: best.bookmaker,
        priceSpreadPct: Math.round(priceSpreadPct * 10) / 10,
      };
    });

    if (outcomes.length === 0) continue;

    candidates.push({
      marketId: m.id,
      sport: m.sport,
      leagueName: m.leagueName,
      country: m.country,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      startTime: m.startTime,
      outcomes,
    });
  }

  candidates.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return candidates;
}
