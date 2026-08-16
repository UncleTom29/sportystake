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
 * The client already signed and confirmed `claimWinnings(betId)` via
 * Circle before calling this — verifies the receipt's `WinningsClaimed`
 * event (id + owner) and marks the bet CLAIMED.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);

    const { id } = await ctx.params;
    const bet = await BetsRepo.byId(id);
    if (!bet) throw new ApiError("NotFound", "Bet not found", 404);
    if (bet.userId !== auth.sub) throw new ApiError("Forbidden", "Not your bet", 403);
    if (bet.status !== "WON") throw new ApiError("Conflict", "Bet is not in a claimable state", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const claim = await verifyClaim(parsed.data.txHash as `0x${string}`, "WinningsClaimed", auth.addr);
    if (claim.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("BetMismatch", "Transaction claimed a different bet", 400);
    }

    await prisma.bet.update({
      where: { id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        txHash: parsed.data.txHash,
        potentialPayout: claim.amount,
      },
    });
    const updated = await BetsRepo.byId(id);

    return ok({ bet: updated, payoutUsdc: claim.amount.toString() });
  },
);
