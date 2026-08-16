export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { publicClient } from "@/lib/server/chain";
import { getVirtualLiquidityConfig } from "@/lib/server/virtualLiquidityStore";
import { clientEnv } from "@/lib/env";
import type { Address } from "viem";

export const runtime = "nodejs";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

import { redis } from "@/lib/server/redis";

const VAULT_CACHE_KEY = "cache:casino:vault";

/**
 * GET /api/casino/vault
 * Returns total Casino Vault liquidity (real on-chain CasinoHouse USDC balance + admin virtual liquidity).
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  try {
    const cached = await redis().get(VAULT_CACHE_KEY);
    if (cached) {
      return ok(JSON.parse(cached));
    }
  } catch {}

  const casinoHouse = clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS as Address;
  const usdc = clientEnv.NEXT_PUBLIC_USDC_ADDRESS as Address;

  let realBalanceUsdc = 0;
  try {
    if (casinoHouse && usdc) {
      const pc = publicClient();
      const raw = await pc.readContract({
        address: usdc,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [casinoHouse],
      });
      realBalanceUsdc = Number(raw) / 1_000_000;
    }
  } catch (err) {
    // Fallback if contract query fails
  }

  const virtConfig = getVirtualLiquidityConfig();
  const totalVaultLiquidity = realBalanceUsdc + virtConfig.casinoVaultUsdc;

  const data = {
    realBalanceUsdc,
    virtualLiquidityUsdc: virtConfig.casinoVaultUsdc,
    totalVaultLiquidityUsdc: totalVaultLiquidity,
    formattedTotal: `$${totalVaultLiquidity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
  };

  try {
    await redis().set(VAULT_CACHE_KEY, JSON.stringify(data), "EX", 5);
  } catch {}

  return ok(data);
});
