import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const s = store();
  const bet = s.bets.find((b) => b.id === id);
  if (!bet) return fail("NotFound", "Bet not found", 404);
  return ok(bet);
});
