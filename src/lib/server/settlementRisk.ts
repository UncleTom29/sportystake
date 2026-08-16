/**
 * Settlement risk & liability assessment.
 *
 * Used by the settlement worker to prevent automated single-provider settlement
 * of markets with massive financial exposure (e.g. > $10,000 USDC payout).
 * High-liability markets are flagged for manual admin review before on-chain
 * settlement is executed.
 */
import { prisma } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";

/** Default threshold: 10,000 USDC in 6-decimal units (10,000,000,000). */
export const DEFAULT_HIGH_LIABILITY_THRESHOLD_USDC = 10_000n * 1_000_000n;

export interface MarketRiskAssessment {
  marketId: string;
  totalPendingBets: number;
  totalPotentialPayoutUsdc: bigint;
  requiresManualReview: boolean;
  reason?: string;
}

/**
 * Calculates total financial exposure across all pending bets on a market
 * and determines if automated settlement should be gated for admin review.
 */
export async function assessMarketSettlementRisk(
  marketId: string,
  thresholdUsdc: bigint = DEFAULT_HIGH_LIABILITY_THRESHOLD_USDC,
): Promise<MarketRiskAssessment> {
  const pendingBets = await prisma.bet.findMany({
    where: { marketId, status: "PENDING" },
    select: { id: true, potentialPayout: true },
  });

  let totalPayout = 0n;
  for (const bet of pendingBets) {
    totalPayout += bet.potentialPayout;
  }

  const exceedsThreshold = totalPayout >= thresholdUsdc;

  if (exceedsThreshold) {
    logger.critical(
      "[settlement-risk] High liability market detected — automated settlement gated",
      {
        marketId,
        totalPendingBets: pendingBets.length,
        totalPotentialPayoutUsdc: totalPayout.toString(),
        thresholdUsdc: thresholdUsdc.toString(),
      },
    );
  }

  return {
    marketId,
    totalPendingBets: pendingBets.length,
    totalPotentialPayoutUsdc: totalPayout,
    requiresManualReview: exceedsThreshold,
    ...(exceedsThreshold
      ? { reason: `Total potential payout (${(Number(totalPayout) / 1e6).toFixed(2)} USDC) exceeds threshold (${(Number(thresholdUsdc) / 1e6).toFixed(2)} USDC)` }
      : {}),
  };
}
