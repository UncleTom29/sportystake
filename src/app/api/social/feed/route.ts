import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

/**
 * Public activity feed. Sources from real Bet rows (public ones, recent)
 * and joins user + market so the UI can show "alice bet $50 on Liverpool".
 */
export const GET = withRequestId(async (req: NextRequest) => {
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? "30"));
  const bets = await prisma.bet.findMany({
    where: { isPublic: true },
    orderBy: { placedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, walletAddress: true, username: true } },
      market: { select: { id: true, homeTeam: true, awayTeam: true } },
    },
  });

  const items = bets.map((b) => ({
    id: b.id,
    kind: "bet" as const,
    user: {
      id: b.user.id,
      username: b.user.username ?? undefined,
      walletAddress: b.user.walletAddress,
    },
    marketId: b.market.id,
    marketLabel: `${b.market.homeTeam} vs ${b.market.awayTeam}`,
    selectionLabel: b.selectionLabel,
    amount: usdcToString(b.amount),
    oddsX1000: b.oddsX1000,
    status: b.status,
    createdAt: b.placedAt.toISOString(),
    likes: 0,
  }));

  return ok({ items });
});
