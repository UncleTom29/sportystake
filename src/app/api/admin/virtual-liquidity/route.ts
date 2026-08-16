export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { getVirtualLiquidityConfig, updateVirtualLiquidityConfig } from "@/lib/server/virtualLiquidityStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/virtual-liquidity
 * Returns current virtual liquidity configuration for Sports Pool & Casino Vault.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const config = getVirtualLiquidityConfig();
  return ok({ config });
});

/**
 * POST /api/admin/virtual-liquidity
 * Updates virtual liquidity configuration for Sports Pool & Casino Vault.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("BadRequest", "Invalid JSON body", 400);
  }

  const { sportsPoolUsdc, casinoVaultUsdc, virtualWageredUsdc } = body;
  const config = updateVirtualLiquidityConfig({
    sportsPoolUsdc: typeof sportsPoolUsdc === "number" ? sportsPoolUsdc : undefined,
    casinoVaultUsdc: typeof casinoVaultUsdc === "number" ? casinoVaultUsdc : undefined,
    virtualWageredUsdc: typeof virtualWageredUsdc === "number" ? virtualWageredUsdc : undefined,
  });

  return ok({ config, message: "Virtual stats & liquidity updated successfully" });
});
