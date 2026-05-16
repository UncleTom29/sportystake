import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const s = store();
  const now = Date.now();
  const dayMs = 86400_000;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;

  let volToday = 0n, volWeek = 0n, volMonth = 0n;
  let ggrToday = 0n, ggrWeek = 0n, ggrMonth = 0n;
  for (const b of s.bets) {
    const t = new Date(b.createdAt).getTime();
    const amt = utils.fromUsdc(b.amount);
    const payout = b.status === "WON" || b.status === "CASHED" ? utils.fromUsdc(b.potentialPayout) : 0n;
    const ggr = amt - payout;
    if (now - t < dayMs) { volToday += amt; ggrToday += ggr; }
    if (now - t < weekMs) { volWeek += amt; ggrWeek += ggr; }
    if (now - t < monthMs) { volMonth += amt; ggrMonth += ggr; }
  }

  const lpTvl = s.markets.reduce((acc, m) => acc + utils.fromUsdc(m.poolTvl), 0n);
  const activeUsers = new Set(s.bets.filter((b) => now - new Date(b.createdAt).getTime() < dayMs).map((b) => b.userId)).size;
  const openLpMarkets = s.markets.filter((m) => m.status === "OPEN").length;

  return ok({
    ggr: { today: utils.toUsdc(ggrToday), week: utils.toUsdc(ggrWeek), month: utils.toUsdc(ggrMonth) },
    volume: { today: utils.toUsdc(volToday), week: utils.toUsdc(volWeek), month: utils.toUsdc(volMonth) },
    activeUsersToday: activeUsers,
    bets: s.bets.length,
    lpTvl: utils.toUsdc(lpTvl),
    openLpMarkets,
  });
});
