import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import {
  planScoreBasedSettlement,
  planDirectOutcomeSettlement,
  executeMarketSettlement,
  resolveScoreBasedOutcome,
} from "@/lib/server/settlement";

export const runtime = "nodejs";

const Body = z.union([
  // Sports markets: provide the final score and every market type with
  // bets on this market (1X2, totals, BTTS, asian handicap) is resolved
  // automatically from it — same resolver the automated oracle-driven path
  // uses. Persists the score onto the Market row too, in case the oracle
  // never captured it.
  z.object({
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0),
  }),
  // Prediction markets (no score to derive an outcome from) or a manual
  // override for one specific market type the score resolver can't handle
  // on its own (e.g. an Asian handicap quarter-line) — forces this exact
  // outcome index as the winner for that market type only.
  z.object({
    winningOutcome: z.number().int().min(0).max(10),
    marketType: z.string().min(1).optional(),
  }),
]);

/**
 * Admin-initiated market settlement — a fallback for when the automated
 * path (oracle's live poller for sports, settleResolvedPolymarketMarkets
 * for prediction markets) hasn't fired. Runs the exact same settlement
 * logic those use (src/lib/server/settlement.ts) rather than a separate,
 * narrower implementation, so this can't drift out of correctness with
 * them the way the old version had (it recomputed a 1X2-only outcome from
 * fields that don't exist on non-score-based markets).
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

    const market = await prisma.market.findUnique({ where: { id } });
    if (!market) return fail("NotFound", "Market not found", 404);
    if (market.status === "SETTLED" || market.status === "CANCELLED") {
      return fail("Conflict", `Market is already ${market.status.toLowerCase()}`, 409);
    }

    let primaryWinningOutcome: number;
    let plan: Awaited<ReturnType<typeof planScoreBasedSettlement>>;

    if ("homeScore" in parsed.data) {
      const { homeScore, awayScore } = parsed.data;
      await prisma.market.update({ where: { id }, data: { homeScore, awayScore } });
      primaryWinningOutcome = resolveScoreBasedOutcome("1X2", homeScore, awayScore) ?? 0;
      plan = await planScoreBasedSettlement(id, homeScore, awayScore);
    } else {
      const marketType = parsed.data.marketType ?? (market.sport === "prediction-markets" ? "binary" : "1X2");
      primaryWinningOutcome = parsed.data.winningOutcome;
      plan = await planDirectOutcomeSettlement(id, marketType, parsed.data.winningOutcome);
    }

    const { settleTxHash, voidTxHashes } = await executeMarketSettlement({
      marketId: id,
      primaryWinningOutcome,
      plan,
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "market.settle",
        target: id,
        details: {
          ...parsed.data,
          primaryWinningOutcome,
          settleTxHash,
          voidTxHashes,
          winningBetIds: plan.winningBetIds,
          voidedBetIds: plan.voidedBetIds,
          totalPayout: plan.totalPayout.toString(),
          unresolved: plan.unresolved,
        },
      },
    });

    publish("market:finished", { marketId: id, primaryWinningOutcome });

    return ok({
      market: await MarketsRepo.byId(id),
      won: plan.winningBetIds.length,
      voided: plan.voidedBetIds.length,
      unresolved: plan.unresolved,
    });
  },
);
