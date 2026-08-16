import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { BetsRepo } from "@/lib/server/repos/bets.repo";
import { prisma } from "@/lib/server/db";
import { verifyClaim } from "@/lib/server/betVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * Didn't exist before Circle signing — the client now signs and confirms
 * `claimRefund(betId)` via Circle before calling this. Verifies the
 * receipt's `RefundClaimed` event and marks the bet CANCELLED.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);

    const { id } = await ctx.params;
    const bet = await BetsRepo.byId(id);
    if (!bet) throw new ApiError("NotFound", "Bet not found", 404);
    if (bet.userId !== auth.sub) throw new ApiError("Forbidden", "Not your bet", 403);
    if (bet.status !== "PENDING") throw new ApiError("Conflict", "Bet is not refundable", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const refund = await verifyClaim(parsed.data.txHash as `0x${string}`, "RefundClaimed", auth.addr);
    if (refund.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("BetMismatch", "Transaction refunded a different bet", 400);
    }

    await prisma.bet.update({
      where: { id },
      data: { status: "CANCELLED", settledAt: new Date(), txHash: parsed.data.txHash },
    });
    const updated = await BetsRepo.byId(id);

    return ok({ bet: updated, refundUsdc: refund.amount.toString() });
  },
);
