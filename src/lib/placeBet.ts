"use client";

// Bridges the existing BetSelection shape (matchId, matchLabel, market, selection, odds)
// to the API-level bet payload (marketId, marketType, outcome, oddsX1000).
// Looks up the market detail to resolve the market type and outcome by label.

import type { BetSelection } from "@/lib/betSlipStore";
import type { BetDTO, ParlayDTO, MarketDTO, MarketType } from "@/lib/types";
import { Markets, Bets } from "@/lib/api-client";

interface ResolvedLeg {
  marketId: string;
  marketType: MarketType;
  outcome: number;
  selectionLabel: string;
  oddsX1000: number;
}

function marketTypeFromMarketName(name: string): MarketType {
  const n = name.toLowerCase();
  if (n.includes("over") && n.includes("1.5")) return "over_under_15";
  if (n.includes("over") && n.includes("3.5")) return "over_under_35";
  if (n.includes("over") || n.includes("under") || n.includes("o/u")) return "over_under_25";
  if (n.includes("btts") || n.includes("both teams")) return "btts";
  if (n.includes("double")) return "double_chance";
  if (n.includes("handicap")) return "asian_handicap";
  if (n.includes("half")) return "half_time_result";
  return "1X2";
}

async function resolveLeg(sel: BetSelection): Promise<ResolvedLeg | null> {
  let market: MarketDTO | null = null;
  try {
    market = await Markets.detail(sel.matchId);
  } catch {
    return null;
  }
  if (!market) return null;
  const candidateType = marketTypeFromMarketName(sel.market);
  const bundle = market.odds.find((b) => b.marketType === candidateType) ?? market.odds[0];
  if (!bundle) return null;
  // Find selection by label first, fall back to closest odds match
  const byLabel = bundle.selections.find((s) => s.label.toLowerCase() === sel.selection.toLowerCase());
  const closest = byLabel ?? bundle.selections.reduce((best, cur) => {
    const dBest = Math.abs(best.valueX1000 - Math.round(sel.odds * 1000));
    const dCur = Math.abs(cur.valueX1000 - Math.round(sel.odds * 1000));
    return dCur < dBest ? cur : best;
  }, bundle.selections[0]);
  return {
    marketId: market.id,
    marketType: bundle.marketType,
    outcome: closest.outcome,
    selectionLabel: closest.label,
    oddsX1000: closest.valueX1000,
  };
}

export async function placeSingleBets(
  selections: BetSelection[],
  stakePerBet: number,
  opts?: { isLive?: boolean; isPublic?: boolean; slippageToleranceBps?: number },
): Promise<{ placed: BetDTO[]; failures: { selection: BetSelection; error: string }[] }> {
  if (stakePerBet <= 0) throw new Error("Stake must be greater than zero");
  const placed: BetDTO[] = [];
  const failures: { selection: BetSelection; error: string }[] = [];
  const amount = stakePerBet.toFixed(2);

  for (const sel of selections) {
    const resolved = await resolveLeg(sel);
    if (!resolved) {
      failures.push({ selection: sel, error: "Market not found" });
      continue;
    }
    try {
      const r = await Bets.place({
        marketId: resolved.marketId,
        marketType: resolved.marketType,
        outcome: resolved.outcome,
        selectionLabel: resolved.selectionLabel,
        amount,
        oddsX1000: resolved.oddsX1000,
        slippageToleranceBps: opts?.slippageToleranceBps ?? 50,
        isLive: opts?.isLive ?? false,
        isPublic: opts?.isPublic ?? true,
      });
      placed.push(r.bet);
    } catch (e) {
      failures.push({ selection: sel, error: (e as Error).message });
    }
  }
  return { placed, failures };
}

export async function placeParlay(
  selections: BetSelection[],
  totalStake: number,
  opts?: { isPublic?: boolean },
): Promise<{ parlay: ParlayDTO | null; failures: { selection: BetSelection; error: string }[] }> {
  const legs: ResolvedLeg[] = [];
  const failures: { selection: BetSelection; error: string }[] = [];
  for (const sel of selections) {
    const resolved = await resolveLeg(sel);
    if (!resolved) failures.push({ selection: sel, error: "Market not found" });
    else legs.push(resolved);
  }
  if (legs.length < 2) return { parlay: null, failures };
  try {
    const r = await Bets.parlay({
      selections: legs.map((l) => ({
        marketId: l.marketId,
        marketType: l.marketType,
        outcome: l.outcome,
        selectionLabel: l.selectionLabel,
        oddsX1000: l.oddsX1000,
      })),
      totalStake: totalStake.toFixed(2),
      isPublic: opts?.isPublic ?? true,
    });
    return { parlay: r.parlay, failures };
  } catch (e) {
    failures.push({ selection: selections[0], error: (e as Error).message });
    return { parlay: null, failures };
  }
}
