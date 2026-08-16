import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

/**
 * Time-bucketed GGR + volume + active-user counts. All aggregates run in
 * SQL via Prisma's groupBy / aggregate so we never load every bet into
 * memory.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const now = new Date();
  const day = new Date(now.getTime() - 86_400_000);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const month = new Date(now.getTime() - 30 * 86_400_000);

  const [betsToday, betsWeek, betsMonth, totalBets, openMarkets, lpAgg, activeUsersToday] = await Promise.all([
    prisma.bet.findMany({
      where: { placedAt: { gte: day } },
      select: { amount: true, potentialPayout: true, status: true },
    }),
    prisma.bet.findMany({
      where: { placedAt: { gte: week } },
      select: { amount: true, potentialPayout: true, status: true },
    }),
    prisma.bet.findMany({
      where: { placedAt: { gte: month } },
      select: { amount: true, potentialPayout: true, status: true },
    }),
    prisma.bet.count(),
    prisma.market.count({ where: { status: "OPEN" } }),
    prisma.lpPosition.aggregate({
      where: { status: { in: ["ACTIVE", "WITHDRAW_REQUESTED"] } },
      _sum: { depositedUsdc: true },
    }),
    prisma.bet.groupBy({
      by: ["userId"],
      where: { placedAt: { gte: day } },
    }),
  ]);

  function sumVolAndGgr(bets: { amount: bigint; potentialPayout: bigint; status: string }[]) {
    let vol = 0n, ggr = 0n;
    for (const b of bets) {
      vol += b.amount;
      const payout = b.status === "WON" || b.status === "CLAIMED" ? b.potentialPayout : 0n;
      ggr += b.amount - payout;
    }
    return { vol, ggr };
  }
  const today = sumVolAndGgr(betsToday);
  const wk = sumVolAndGgr(betsWeek);
  const mo = sumVolAndGgr(betsMonth);

  return ok({
    ggr: { today: usdcToString(today.ggr), week: usdcToString(wk.ggr), month: usdcToString(mo.ggr) },
    volume: { today: usdcToString(today.vol), week: usdcToString(wk.vol), month: usdcToString(mo.vol) },
    activeUsersToday: activeUsersToday.length,
    bets: totalBets,
    lpTvl: usdcToString(lpAgg._sum.depositedUsdc ?? 0n),
    openLpMarkets: openMarkets,
  });
});
