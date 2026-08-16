import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { BetsRepo } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const bet = await BetsRepo.byId(id);
    if (!bet) return fail("NotFound", "Bet not found", 404);
    return ok(bet);
  },
);
