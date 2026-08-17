import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { verifyClaim } from "@/lib/server/betVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * Parlay counterpart to /api/bets/[id]/refund. claimParlayRefund itself
 * only succeeds once every leg has been evaluated Void (see
 * BettingCore.sol's _evaluateParlay) — a leg's market being cancelled
 * with no other leg lost, same trigger as a single bet's claimRefund. No
 * separate "cancelled" precondition to check here since Parlay.status
 * only flips once claimParlayRefund itself has already succeeded on-chain
 * (unlike Bet, which BettingCore.cancelMarket marks CANCELLED up front).
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);

    const { id } = await ctx.params;
    const parlay = await prisma.parlay.findUnique({ where: { id } });
    if (!parlay) throw new ApiError("NotFound", "Parlay not found", 404);
    if (parlay.userId !== auth.sub) throw new ApiError("Forbidden", "Not your parlay", 403);
    if (parlay.status === "CLAIMED") throw new ApiError("Conflict", "Parlay refund already claimed", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const claim = await verifyClaim(parsed.data.txHash as `0x${string}`, "ParlayRefunded", auth.addr);
    if (claim.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("ParlayMismatch", "Transaction refunded a different parlay", 400);
    }

    const updated = await prisma.parlay.update({
      where: { id },
      data: { status: "CLAIMED", txHash: parsed.data.txHash },
    });

    return ok({
      parlay: { id: updated.id, status: updated.status },
      refundUsdc: claim.amount.toString(),
    });
  },
);
