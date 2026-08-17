/**
 * On-chain bet settlement worker.
 *
 * Lifecycle per market:
 *   1. Oracle publishes `market:finished` on Redis (channel from
 *      packages/oracle/src/cache/cache-keys.ts) with the final score.
 *   2. We plan a full settlement pass across every market type that has
 *      bets on this market (1X2, totals, BTTS, asian handicap — see
 *      `src/lib/server/settlement.ts` for why this can't be done as a
 *      single 1X2-shaped winningOutcome the way it used to be).
 *   3. We execute it: void any pushes/unsupported bets first, then call
 *      `BettingCore.settleMarket(...)` once with the unioned winners.
 *   4. We reconcile the Prisma `Bet`/`Market` rows to match.
 *
 * Operator key:
 *   - Uses the centralized `operatorWallet` factory (Fix #3). Reads
 *     `OPERATOR_PRIVATE_KEY_BETTING` first, falls back to `OPERATOR_PRIVATE_KEY`.
 *   - The worker REQUIRES a key in production. In dev it logs a warning
 *     and exits cleanly.
 *
 * Run it:
 *   `npx tsx src/workers/settlement.worker.ts`
 *
 *   Or via the root `npm run worker:settlement` script (added to package.json).
 */
// Env is loaded via Node's `--env-file=.env` flag (see package.json scripts).
import { redisSubscriber } from "@/lib/server/redis";
import { prisma } from "@/lib/server/db";
import { serverEnv, clientEnv } from "@/lib/env";
import { getOperatorAccount, verifyOperatorRoles } from "@/lib/server/operatorWallet";
import { logger } from "@/lib/server/logger";
import { planScoreBasedSettlement, executeMarketSettlement, resolveScoreBasedOutcome } from "@/lib/server/settlement";

const CHANNEL_MARKET_FINISHED = "market:finished";

interface FinishedEvent {
  type: "market:finished";
  fixtureId: number;
  homeScore: number;
  awayScore: number;
}

async function bootstrap(): Promise<void> {
  // Fix #3: use per-contract operator wallet
  const account = getOperatorAccount("bettingCore");
  if (!account) {
    if (serverEnv.NODE_ENV === "production") {
      throw new Error("Operator key for bettingCore required for settlement worker");
    }
    logger.warn("[settlement] No operator key configured — worker idle in dev");
    return;
  }

  logger.info("[settlement] operator ready", { address: account.address });
  await verifyOperatorRoles([{ name: "bettingCore", address: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}` }]);

  const sub = redisSubscriber();
  await sub.subscribe(CHANNEL_MARKET_FINISHED);

  sub.on("message", async (channel, raw) => {
    if (channel !== CHANNEL_MARKET_FINISHED) return;
    try {
      const evt = JSON.parse(raw) as FinishedEvent;
      const market = await prisma.market.findUnique({ where: { fixtureId: BigInt(evt.fixtureId) } });
      if (!market) {
        logger.warn("[settlement] no market for fixture", { fixtureId: evt.fixtureId });
        return;
      }
      if (market.status === "SETTLED" || market.status === "CANCELLED") return;

      // The Market row's own winningOutcome is 1X2-shaped (0/1/2) purely
      // for display/back-compat on markets that have a 1X2 book at all —
      // it's not what determines any bet's fate. That happens per market
      // type inside the plan below.
      const primaryWinningOutcome = resolveScoreBasedOutcome("1X2", evt.homeScore, evt.awayScore) ?? 0;
      const plan = await planScoreBasedSettlement(market.id, evt.homeScore, evt.awayScore);

      // Gap 2: Check liability exposure before automated settlement
      const { assessMarketSettlementRisk } = await import("@/lib/server/settlementRisk");
      const risk = await assessMarketSettlementRisk(market.id);
      if (risk.requiresManualReview) {
        logger.critical(
          "[settlement] HIGH LIABILITY: Market settlement requires manual admin review",
          {
            marketId: market.id,
            totalPayoutUsdc: risk.totalPotentialPayoutUsdc.toString(),
            reason: risk.reason,
          },
        );
        // Flag market for manual review in Postgres
        await prisma.market.update({
          where: { id: market.id },
          data: {
            metadata: {
              ...((market.metadata as Record<string, unknown> | null) ?? {}),
              needsManualReview: true,
              reviewReason: risk.reason,
              finishedScores: { homeScore: evt.homeScore, awayScore: evt.awayScore },
            },
          },
        });
        return;
      }

      const { settleTxHash, voidTxHashes } = await executeMarketSettlement({
        marketId: market.id,
        primaryWinningOutcome,
        plan,
      });

      logger.info("[settlement] market settled", {
        marketId: market.id,
        onchain: settleTxHash ?? "off-chain",
        voided: voidTxHashes.length,
        won: plan.winningBetIds.length,
        unresolved: plan.unresolved.length,
      });
    } catch (err) {
      logger.error("[settlement] error", { error: String(err) });
    }
  });

  logger.info("[settlement] subscribed", { channel: CHANNEL_MARKET_FINISHED });
}

bootstrap().catch((err) => {
  logger.critical("[settlement] fatal", { error: String(err) });
  process.exit(1);
});
