import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { getPoolStats, store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest, ctx: { params: Promise<{ marketId: string }> }) => {
  const { marketId } = await ctx.params;
  const s = store();
  const market = s.markets.find((m) => m.id === marketId);
  if (!market) return fail("NotFound", "Market not found", 404);
  const pool = getPoolStats(marketId);
  return ok({ market, pool });
});
