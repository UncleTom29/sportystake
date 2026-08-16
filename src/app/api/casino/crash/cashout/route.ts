import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { verifyCashedOut } from "@/lib/server/crashVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * The client already signed and confirmed `CrashGame.cashOut` via Circle.
 * Verifies the `PlayerCashedOut` receipt and records the claimed
 * multiplier — final WON/LOST status + payout still comes from the
 * worker's post-resolve reconciliation against `PayoutCredited`, since a
 * self-reported cashout only counts if it landed before the crash point.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

  const verified = await verifyCashedOut(parsed.data.txHash as `0x${string}`, auth.addr);

  const bet = await prisma.casinoBet.findFirst({
    where: { userId: auth.sub, game: "CRASH", nonce: Number(verified.roundId), status: "PENDING" },
    orderBy: { placedAt: "desc" },
  });
  if (!bet) throw new ApiError("NotFound", "No pending bet for this round", 404);

  const md = (bet.metadata as Record<string, unknown> | null) ?? null;
  await prisma.casinoBet.update({
    where: { id: bet.id },
    data: { metadata: { ...md, cashedOutAtX100: Number(verified.multiplierX100) } },
  });

  publish("crash:state", { kind: "cashout", userId: auth.sub, multiplierX100: Number(verified.multiplierX100) });
  return ok({ cashedOutAtX100: Number(verified.multiplierX100) });
});
