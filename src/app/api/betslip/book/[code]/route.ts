import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(
  async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
    let { code } = await ctx.params;
    code = code.trim().toUpperCase();

    let booked = await prisma.bookedBet.findUnique({
      where: { code },
    });

    if (!booked && code.startsWith("ST-")) {
      booked = await prisma.bookedBet.findUnique({
        where: { code: code.replace(/^ST-/, "") },
      });
    }

    if (!booked) {
      // Check if there is a Bet with this booking code
      const bet = await prisma.bet.findFirst({
        where: { OR: [{ bookingCode: code }, { id: { startsWith: `0x${code.replace(/^ST-/, "").toLowerCase()}` } }] },
        include: { market: true },
      });
      if (bet && bet.market) {
        return ok({
          code,
          totalOdds: bet.oddsX1000 / 1000,
          itemCount: 1,
          selections: [
            {
              matchId: bet.marketId,
              matchLabel: `${bet.market.homeTeam} vs ${bet.market.awayTeam}`,
              market: bet.marketType,
              selection: bet.selectionLabel,
              odds: bet.oddsX1000 / 1000,
              stake: Number(bet.amount) / 1e6,
            },
          ],
          createdAt: bet.placedAt.toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      }

      // Check if there is a Parlay with this booking code
      const parlay = await prisma.parlay.findFirst({
        where: { OR: [{ bookingCode: code }, { id: { startsWith: `0x${code.replace(/^ST-/, "").toLowerCase()}` } }] },
        include: { legs: { include: { market: true } } },
      });
      if (parlay && parlay.legs.length > 0) {
        return ok({
          code,
          totalOdds: Number(parlay.combinedOddsX1000) / 1000,
          itemCount: parlay.legs.length,
          selections: parlay.legs.map((l) => ({
            matchId: l.marketId,
            matchLabel: `${l.market.homeTeam} vs ${l.market.awayTeam}`,
            market: l.marketType ?? "1X2",
            selection: l.selectionLabel,
            odds: (l.oddsX1000 ?? 1000) / 1000,
            stake: Number(parlay.stake) / 1e6,
          })),
          createdAt: parlay.placedAt.toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      }

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
