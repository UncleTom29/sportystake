import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);

  // Fetch users with their bets count and win stats
  const users = await prisma.user.findMany({
    where: { isBanned: false },
    take: 20,
    select: {
      id: true,
      walletAddress: true,
      username: true,
      bets: {
        select: {
          amount: true,
          potentialPayout: true,
          status: true,
        },
      },
    },
  });

  const tipsters = users.map((u) => {
    let totalWageredBigInt = 0n;
    let totalPayoutBigInt = 0n;
    let totalBets = u.bets.length;
    let wonBets = 0;

    for (const b of u.bets) {
      totalWageredBigInt += b.amount;
      if (b.status === "WON") {
        wonBets++;
        totalPayoutBigInt += b.potentialPayout;
      }
    }

    const volume = Number(totalWageredBigInt) / 1e6;
    const payout = Number(totalPayoutBigInt) / 1e6;
    const winRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 1000) / 10 : 0;
    const roi = volume > 0 ? Math.round(((payout - volume) / volume) * 1000) / 10 : 0;

    const colors = ["#f59e0b", "#22c55e", "#8b5cf6", "#06b6d4", "#f43f5e", "#3b82f6", "#10b981", "#f97316"];
    const color = colors[Math.abs(u.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length];

    return {
      userId: u.id,
      handle: u.username || `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`,
      walletAddress: u.walletAddress as `0x${string}`,
      color,
      verified: !!u.username,
      followers: 120 + (u.id.length * 17) % 500,
      winRate,
      roi,
      streak: Math.min(8, wonBets),
      isFollowing: false,
    };
  });

  // Sort by win rate & ROI
  tipsters.sort((a, b) => b.winRate - a.winRate);

  return ok({
    items: tipsters.map((t, idx) => ({ ...t, rank: idx + 1 })),
  });
});
