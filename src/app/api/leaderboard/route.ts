import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "sports") as "sports" | "casino" | "roi" | "streaks" | "referrals";
  const period = (searchParams.get("period") || "weekly") as "daily" | "weekly" | "monthly" | "alltime";

  const now = new Date();
  let periodStart: Date | undefined;
  if (period === "daily") {
    periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "weekly") {
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "monthly") {
    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch all users with sports bets, casino bets, and referred users count
  const users = await prisma.user.findMany({
    where: { isBanned: false },
    select: {
      id: true,
      walletAddress: true,
      username: true,
      avatar: true,
      referralCode: true,
      bets: {
        where: {
          ...(periodStart ? { placedAt: { gte: periodStart } } : {}),
        },
        select: {
          amount: true,
          potentialPayout: true,
          status: true,
          placedAt: true,
        },
      },
      casinoBets: {
        where: {
          ...(periodStart ? { placedAt: { gte: periodStart } } : {}),
        },
        select: {
          amount: true,
          payout: true,
          status: true,
          placedAt: true,
        },
      },
    },
  });

  // Fetch referral counts per user
  const referralCounts = await prisma.user.groupBy({
    by: ["referredById"],
    _count: { _all: true },
    where: {
      referredById: { not: null },
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
    },
  });

  const refMap = new Map<string, number>();
  for (const rc of referralCounts) {
    if (rc.referredById) {
      refMap.set(rc.referredById, rc._count._all);
    }
  }

  // Calculate statistics for each user
  const aggregated = users.map((u) => {
    let totalWageredBigInt = 0n;
    let totalPayoutBigInt = 0n;
    let totalBetsCount = 0;
    let wonBetsCount = 0;
    let streak = 0;

    if (category === "casino") {
      totalBetsCount = u.casinoBets.length;
      for (const cb of u.casinoBets) {
        totalWageredBigInt += cb.amount;
        totalPayoutBigInt += cb.payout;
        if (cb.status === "WON") wonBetsCount++;
      }
      const sorted = [...u.casinoBets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
      for (const cb of sorted) {
        if (cb.status === "WON") streak++;
        else break;
      }
    } else {
      totalBetsCount = u.bets.length;
      for (const b of u.bets) {
        totalWageredBigInt += b.amount;
        if (b.status === "WON") {
          wonBetsCount++;
          totalPayoutBigInt += b.potentialPayout;
        }
      }
      const sorted = [...u.bets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
      for (const b of sorted) {
        if (b.status === "WON") streak++;
        else break;
      }
    }

    const volume = Number(totalWageredBigInt) / 1e6;
    const payout = Number(totalPayoutBigInt) / 1e6;
    const pnl = Math.round((payout - volume) * 100) / 100;
    const winRate = totalBetsCount > 0 ? Math.round((wonBetsCount / totalBetsCount) * 1000) / 10 : 0;
    const roi = volume > 0 ? Math.round(((payout - volume) / volume) * 1000) / 10 : 0;
    const referredUsers = refMap.get(u.id) ?? 0;

    const colors = ["#f59e0b", "#22c55e", "#14b8a6", "#06b6d4", "#f43f5e", "#3b82f6", "#10b981", "#f97316"];
    const color = colors[Math.abs(u.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length];

    return {
      userId: u.id,
      handle: u.username ? `@${u.username}` : `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`,
      address: `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`,
      walletAddress: u.walletAddress as `0x${string}`,
      username: u.username ?? undefined,
      avatar: u.avatar || "🎯",
      color,
      verified: !!u.username,
      bets: totalBetsCount,
      winRate,
      volume,
      pnl,
      roi,
      streak,
      referredUsers,
    };
  });

  // Filter users so users who haven't played are not shown on category leaderboards
  const filtered = aggregated.filter((u) => {
    if (category === "casino") return u.bets > 0;
    if (category === "referrals") return u.referredUsers > 0;
    return u.bets > 0;
  });

  // Sort based on category
  if (category === "referrals") {
    filtered.sort((a, b) => b.referredUsers - a.referredUsers || b.volume - a.volume);
  } else if (category === "casino") {
    filtered.sort((a, b) => b.pnl - a.pnl || b.volume - a.volume);
  } else if (category === "roi") {
    filtered.sort((a, b) => b.roi - a.roi || b.pnl - a.pnl);
  } else if (category === "streaks") {
    filtered.sort((a, b) => b.streak - a.streak || b.pnl - a.pnl);
  } else {
    filtered.sort((a, b) => b.pnl - a.pnl || b.volume - a.volume);
  }

  // Assign ranks
  const ranked = filtered.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  // Find requesting user rank
  let currentUserRank = 0;
  let currentUserItem = null;
  if (auth) {
    const found = ranked.find((r) => r.userId === auth.sub);
    if (found) {
      currentUserRank = found.rank;
      currentUserItem = found;
    }
  }

  return ok({
    items: ranked.slice(0, 50),
    total: ranked.length,
    currentUser: currentUserItem
      ? {
          rank: currentUserRank,
          handle: currentUserItem.handle,
          address: currentUserItem.address,
          bets: currentUserItem.bets,
          winRate: currentUserItem.winRate,
          volume: currentUserItem.volume,
          pnl: currentUserItem.pnl,
          roi: currentUserItem.roi,
          streak: currentUserItem.streak,
          referredUsers: currentUserItem.referredUsers,
          avatar: currentUserItem.avatar,
        }
      : null,
  });
});
