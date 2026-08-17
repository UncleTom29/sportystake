import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { verifyClaim } from "@/lib/server/betVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * Parlay counterpart to /api/bets/[id]/claim — same pattern, but Parlay
 * lives in its own table (see prisma/schema.prisma), so this can't reuse
 * BetsRepo.byId. The client already signed and confirmed
 * claimParlayWinnings(parlayId) via Circle before calling this; verifies
 * the receipt's ParlayWon event (id + owner) and marks the parlay CLAIMED.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);

    const { id } = await ctx.params;
    const parlay = await prisma.parlay.findUnique({ where: { id } });
    if (!parlay) throw new ApiError("NotFound", "Parlay not found", 404);
    if (parlay.userId !== auth.sub) throw new ApiError("Forbidden", "Not your parlay", 403);
    if (parlay.status !== "WON") throw new ApiError("Conflict", "Parlay is not in a claimable state", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const claim = await verifyClaim(parsed.data.txHash as `0x${string}`, "ParlayWon", auth.addr);
    if (claim.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("ParlayMismatch", "Transaction claimed a different parlay", 400);
    }

    const updated = await prisma.parlay.update({
      where: { id },
      data: {
        status: "CLAIMED",
        txHash: parsed.data.txHash,
        potentialPayout: claim.amount,
      },
    });

    return ok({
      parlay: { id: updated.id, status: updated.status, potentialPayout: updated.potentialPayout.toString() },
      payoutUsdc: claim.amount.toString(),
    });
  },
);
