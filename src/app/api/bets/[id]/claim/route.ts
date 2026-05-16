import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const { id } = await ctx.params;
  const s = store();
  const bet = s.bets.find((b) => b.id === id);
  if (!bet) return fail("NotFound", "Bet not found", 404);
  if (bet.userId !== auth.sub) return fail("Forbidden", "Not your bet", 403);
  if (bet.status !== "WON") return fail("InvalidState", "Bet is not in WON state", 409);
  bet.status = "CASHED";
  return ok({ bet, txHash: bet.txHash, payoutUsdc: bet.potentialPayout });
});
