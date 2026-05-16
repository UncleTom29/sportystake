import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ marketId: string }> }) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const { marketId } = await ctx.params;
  const s = store();
  const pos = s.lpPositions.find((p) => p.userId === auth.sub && p.marketId === marketId);
  if (!pos) return fail("NotFound", "No position for this market", 404);
  return ok(pos);
});
