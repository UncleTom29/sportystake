import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { CasinoStatus } from "@prisma/client";
import { parseUsdc } from "../../../../../../../packages/sdk/src/utils";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

const SettleCasinoBody = z.object({
  status: z.enum(["WON", "LOST", "REFUNDED", "CANCELLED"]),
  payoutUsdc: z.string().optional().default("0.00"),
});

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
      throw new ApiError("Forbidden", "Admin or Operator access required", 403);
    }

    const { id } = await ctx.params;
    const parsed = SettleCasinoBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const bet = await prisma.casinoBet.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!bet) throw new ApiError("NotFound", "Casino bet not found", 404);

    const { status, payoutUsdc } = parsed.data;
    const payoutBigInt = parseUsdc(parseFloat(payoutUsdc || "0") || 0);

    // Calculate multiplier: multiplierX100 = payout / amount * 100
    const amountBigInt = bet.amount > 0n ? bet.amount : 1_000_000n;
    const multiplierX100 = status === "WON" ? Math.round(Number((payoutBigInt * 100n) / amountBigInt)) : 0;

    const updated = await prisma.casinoBet.update({
      where: { id },
      data: {
        status: status as CasinoStatus,
        payout: status === "WON" ? payoutBigInt : 0n,
        multiplierX100,
        resolvedAt: new Date(),
        metadata: {
          ...((bet.metadata as object) || {}),
          adminOverridden: true,
          overriddenBy: auth.sub,
          overriddenAt: new Date().toISOString(),
        },
      },
      include: { user: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: auth.sub,
        action: "CASINO_BET_OVERRIDE",
        target: id,
        details: { status, payoutUsdc, previousStatus: bet.status, game: bet.game },
      },
    });

    // Publish event
    void publish("casino:win", {
      betId: updated.id,
      userId: updated.userId,
      game: updated.game,
      status: updated.status,
      payout: (Number(updated.payout) / 1e6).toString(),
    });

    return ok({
      bet: {
        id: updated.id,
        game: updated.game,
        amount: (Number(updated.amount) / 1e6).toFixed(2),
        multiplierX100: updated.multiplierX100,
        payout: (Number(updated.payout) / 1e6).toFixed(2),
        status: updated.status,
        requestId: updated.requestId,
        placedAt: updated.placedAt.toISOString(),
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      },
    });
  },
);
