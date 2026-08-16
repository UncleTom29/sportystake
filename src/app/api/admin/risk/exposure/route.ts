import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";
import { getOnchainPoolStats } from "@/lib/server/chain";
import type { MarketExposureDTO } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Coverage ratio per OPEN/LIVE market = maxLiability / effectiveCapacity,
 * where effectiveCapacity is the single shared LiquidityPool's
 * `totalLiquidity + virtualLiquidity` (matches the on-chain
 * `MAX_POOL_UTILIZATION_BPS` = 8000 = 80% cap the pool enforces per lock).
 * maxLiability stays per-market — it's derived from that market's own
 * pending bets, which is unaffected by the pool becoming shared.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);

  const [onchain, markets] = await Promise.all([
    getOnchainPoolStats(),
    prisma.market.findMany({
      where: { status: { in: ["OPEN", "LIVE"] } },
      select: {
        id: true, homeTeam: true, awayTeam: true, closesAt: true,
        bets: {
          where: { status: "PENDING" },
          select: { amount: true, potentialPayout: true },
        },
      },
      take: 200,
    }),
  ]);

  const effectiveCapacity = onchain.totalLiquidity + onchain.virtualLiquidity;

  const items: MarketExposureDTO[] = markets.map((m) => {
    const totalBet = m.bets.reduce((acc, b) => acc + b.amount, 0n);
    const totalPayoutNeeded = m.bets.reduce((acc, b) => acc + b.potentialPayout, 0n);
    const maxLiabilityRaw = totalPayoutNeeded - totalBet;
    const maxLiability = maxLiabilityRaw > 0n ? maxLiabilityRaw : 0n;
    const coverageRatio = effectiveCapacity > 0n
      ? Number((maxLiability * 10_000n) / effectiveCapacity) / 10_000
      : 0;
    const riskLevel: MarketExposureDTO["riskLevel"] =
      coverageRatio > 0.95 ? "critical" : coverageRatio > 0.8 ? "warning" : "safe";
    return {
      marketId: m.id,
      label: `${m.homeTeam} vs ${m.awayTeam}`,
      closesAt: m.closesAt.toISOString(),
      totalBetAmount: usdcToString(totalBet),
      maxLiability: usdcToString(maxLiability),
      coverageRatio,
      riskLevel,
    };
  });

  items.sort((a, b) => b.coverageRatio - a.coverageRatio);
  return ok({
    pool: {
      tvl: usdcToString(onchain.totalLiquidity),
      virtualLiquidity: usdcToString(onchain.virtualLiquidity),
      effectiveCapacity: usdcToString(effectiveCapacity),
      lockedForPayouts: usdcToString(onchain.lockedForPayouts),
    },
    items,
  });
});
