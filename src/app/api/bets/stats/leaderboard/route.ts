import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";
import type { Address } from "@/lib/types";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const period = (req.nextUrl.searchParams.get("period") ?? "weekly") as
    | "weekly" | "monthly" | "alltime";

  const since = period === "weekly"
    ? new Date(Date.now() - 7 * 86_400_000)
    : period === "monthly"
      ? new Date(Date.now() - 30 * 86_400_000)
      : new Date(0);

  // Aggregate net PnL per user over `since`. Parlays and casino bets
  // (Aviator/Dice/Slots/…) both live in their own tables (see
  // prisma/schema.prisma) — without merging all three in, parlay-only or
  // casino-only bettors are invisible on the leaderboard.
  const [bets, parlays, casinoBets] = await Promise.all([
    prisma.bet.findMany({
      where: { placedAt: { gte: since }, status: { in: ["WON", "LOST", "CLAIMED"] } },
      select: { userId: true, amount: true, potentialPayout: true, status: true, user: true },
    }),
    prisma.parlay.findMany({
      where: { placedAt: { gte: since }, status: { in: ["WON", "LOST", "CLAIMED"] } },
      select: { userId: true, stake: true, potentialPayout: true, status: true, user: true },
    }),
    prisma.casinoBet.findMany({
      where: { placedAt: { gte: since }, status: { in: ["WON", "LOST"] } },
      select: { userId: true, amount: true, payout: true, status: true, user: true },
    }),
  ]);

  const byUser = new Map<string, {
    user: { id: string; walletAddress: string; username: string | null };
    bets: number; won: number; lost: number; vol: bigint; pnl: bigint;
  }>();
  for (const b of [
    ...bets.map((b) => ({ userId: b.userId, amount: b.amount, potentialPayout: b.potentialPayout, status: b.status as string, user: b.user })),
    ...parlays.map((p) => ({ userId: p.userId, amount: p.stake, potentialPayout: p.potentialPayout, status: p.status as string, user: p.user })),
    ...casinoBets.map((cb) => ({ userId: cb.userId, amount: cb.amount, potentialPayout: cb.payout, status: cb.status as string, user: cb.user })),
  ]) {
    const u = byUser.get(b.userId) ?? {
      user: b.user, bets: 0, won: 0, lost: 0, vol: 0n, pnl: 0n,
    };
    u.bets++;
    u.vol += b.amount;
    if (b.status === "WON" || b.status === "CLAIMED") {
      u.won++;
      u.pnl += b.potentialPayout - b.amount;
    } else if (b.status === "LOST") {
      u.lost++;
      u.pnl -= b.amount;
    }
    byUser.set(b.userId, u);
  }

  const items = Array.from(byUser.values())
    .sort((a, b) => (b.pnl > a.pnl ? 1 : b.pnl < a.pnl ? -1 : 0))
    .slice(0, 50)
    .map((e, i) => ({
      rank: i + 1,
      userId: e.user.id,
      walletAddress: e.user.walletAddress as Address,
      username: e.user.username ?? undefined,
      bets: e.bets,
      winRate: e.won + e.lost > 0 ? Math.round((e.won / (e.won + e.lost)) * 1000) / 1000 : 0,
      volume: usdcToString(e.vol),
      pnl: usdcToString(e.pnl),
      streak: 0,
    }));

  return ok({ period, items });
});
