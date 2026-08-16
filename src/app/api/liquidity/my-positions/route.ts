export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { LpRepo } from "@/lib/server/repos/lp.repo";

export const runtime = "nodejs";

/** The signed-in user's position in the single, protocol-wide LiquidityPool. */
export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const position = await LpRepo.forUser(auth.sub);
  return ok({ items: position ? [position] : [], total: position ? 1 : 0 });
});
