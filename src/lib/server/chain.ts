/**
 * Server-side read access to the on-chain LiquidityPool. Used by the
 * liquidity/risk API routes to report the single, protocol-wide pool's
 * real-time state instead of deriving it from Postgres (which only caches
 * per-user positions, not the shared pool's aggregate truth).
 */
import { createPublicClient, http, type Address } from "viem";
import { clientEnv } from "@/lib/env";
import { liquidityPoolAbi } from "../../../packages/sdk/src/contracts/abis/LiquidityPool";

const chain = {
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: "arc",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
  // Standard deterministic-deployer address, confirmed deployed on Arc
  // Testnet — see src/lib/wagmi.ts's matching comment.
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const },
  },
} as const;

let client: ReturnType<typeof createPublicClient> | undefined;

/** Shared server-side read client for the `arc` chain — any route verifying a receipt reuses this. */
export function publicClient() {
  if (!client) {
    client = createPublicClient({
      chain,
      transport: http(clientEnv.NEXT_PUBLIC_RPC_URL, { retryCount: 4, retryDelay: 500 }),
      batch: { multicall: true },
    });
  }
  return client;
}

import { redis } from "./redis";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const POOL_STATS_CACHE_KEY = "cache:pool:stats";
const POOL_STATS_TTL_SEC = 3;

function poolAddress(): Address {
  return clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS as Address;
}

export interface OnchainPoolStats {
  totalLiquidity: bigint;
  totalShares: bigint;
  lockedForPayouts: bigint;
  virtualLiquidity: bigint;
  shareValue: bigint;
}

/** Read the shared pool's aggregate state. Returns all-zero if not deployed. Buffered via Redis (3s TTL). */
export async function getOnchainPoolStats(): Promise<OnchainPoolStats> {
  const address = poolAddress();
  if (address === ZERO_ADDRESS) {
    return { totalLiquidity: 0n, totalShares: 0n, lockedForPayouts: 0n, virtualLiquidity: 0n, shareValue: 10n ** 18n };
  }

  try {
    const cached = await redis().get(POOL_STATS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        totalLiquidity: BigInt(parsed.totalLiquidity),
        totalShares: BigInt(parsed.totalShares),
        lockedForPayouts: BigInt(parsed.lockedForPayouts),
        virtualLiquidity: BigInt(parsed.virtualLiquidity),
        shareValue: BigInt(parsed.shareValue),
      };
    }
  } catch {}

  const pc = publicClient();
  const [totalLiquidity, totalShares, lockedForPayouts, virtualLiquidity, shareValue] = await Promise.all([
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "totalLiquidity" }),
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "totalShares" }),
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "lockedForPayouts" }),
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "virtualLiquidity" }),
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "getShareValue" }),
  ]);

  const stats = { totalLiquidity, totalShares, lockedForPayouts, virtualLiquidity, shareValue };
  try {
    const serialized = JSON.stringify({
      totalLiquidity: totalLiquidity.toString(),
      totalShares: totalShares.toString(),
      lockedForPayouts: lockedForPayouts.toString(),
      virtualLiquidity: virtualLiquidity.toString(),
      shareValue: shareValue.toString(),
    });
    await redis().set(POOL_STATS_CACHE_KEY, serialized, "EX", POOL_STATS_TTL_SEC);
  } catch {}

  return stats;
}

/** Read how much of the shared pool is currently locked against one market. */
export async function getOnchainMarketLocked(marketId: `0x${string}`): Promise<bigint> {
  const address = poolAddress();
  if (address === ZERO_ADDRESS) return 0n;
  return publicClient().readContract({
    address, abi: liquidityPoolAbi, functionName: "marketLocked", args: [marketId],
  });
}

/** Read one user's live position (shares + USDC value) in the shared pool. */
export async function getOnchainUserPosition(user: `0x${string}`): Promise<{ shares: bigint; usdcValue: bigint }> {
  const address = poolAddress();
  if (address === ZERO_ADDRESS) return { shares: 0n, usdcValue: 0n };
  const pc = publicClient();
  const [shares, position] = await Promise.all([
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "shares", args: [user] }),
    pc.readContract({ address, abi: liquidityPoolAbi, functionName: "getUserPosition", args: [user] }),
  ]);
  const [usdcValue] = position;
  return { shares, usdcValue };
}
