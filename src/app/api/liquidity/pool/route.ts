export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";
import { getOnchainPoolStats } from "@/lib/server/chain";
import type { PoolStats } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Aggregate stats for the single, protocol-wide LiquidityPool — replaces
 * the old per-market `/api/liquidity/markets[/:marketId]` and
 * `/api/markets/:id/pool` endpoints, which derived a fake per-market pool
 * from `LpPosition` rows grouped by `marketId`. There is now exactly one
 * pool for the whole protocol, so its state is read directly on-chain.
 */
import { getVirtualLiquidityConfig } from "@/lib/server/virtualLiquidityStore";
import { redis } from "@/lib/server/redis";

const POOL_API_CACHE_KEY = "cache:api:liquidity:pool";

export const GET = withRequestId(async (_req: NextRequest) => {
  try {
    const cached = await redis().get(POOL_API_CACHE_KEY);
    if (cached) return ok(JSON.parse(cached));
  } catch {}

  const [onchain, lpCount] = await Promise.all([
    getOnchainPoolStats(),
    prisma.lpPosition.count({ where: { status: { in: ["ACTIVE", "WITHDRAW_REQUESTED"] } } }),
  ]);

  const virtConfig = getVirtualLiquidityConfig();
  const virtBigInt = BigInt(Math.round(virtConfig.sportsPoolUsdc * 1_000_000));
  const virtualLiquidity = onchain.virtualLiquidity > 0n ? onchain.virtualLiquidity : virtBigInt;

  const effectiveCapacity = onchain.totalLiquidity + virtualLiquidity;
  const utilization = effectiveCapacity === 0n
    ? 0
    : Number((onchain.lockedForPayouts * 10_000n) / effectiveCapacity) / 10_000;
  const estimatedApy = Math.min(45, Math.max(2, utilization * 25));

  const pool: PoolStats = {
    // Report effectiveCapacity (real + virtual) as TVL so total liquidity pool figure looks bigger as requested
    tvl: usdcToString(effectiveCapacity),
    totalShares: onchain.totalShares.toString(),
    locked: usdcToString(onchain.lockedForPayouts),
    virtualLiquidity: usdcToString(virtualLiquidity),
    effectiveCapacity: usdcToString(effectiveCapacity),
    utilization,
    shareValue: (onchain.shareValue).toString(),
    lpCount,
    estimatedApy,
  };

  const responseData = { pool };
  try {
    await redis().set(POOL_API_CACHE_KEY, JSON.stringify(responseData), "EX", 3);
  } catch {}

  return ok(responseData);
});
