import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(
  async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
    let { code } = await ctx.params;
    code = code.trim().toUpperCase();

    const booked = await prisma.bookedBet.findUnique({
      where: { code },
    });

    if (!booked) {
      throw new ApiError("NotFound", `Booking code ${code} not found`, 404);
    }

    if (booked.expiresAt < new Date()) {
      throw new ApiError("Expired", `Booking code ${code} has expired`, 410);
    }

    return ok({
      code: booked.code,
      totalOdds: booked.totalOdds,
      itemCount: booked.itemCount,
      selections: booked.selections,
      createdAt: booked.createdAt.toISOString(),
      expiresAt: booked.expiresAt.toISOString(),
    });
  },
);
