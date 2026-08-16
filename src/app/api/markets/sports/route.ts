export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  // "prediction-markets" is a Market row too (same table, so the sportsbook
  // odds/betslip flow works unchanged for it) but it isn't a real sport —
  // it already has its own dedicated nav entry (see SportsNav.tsx). Without
  // this exclusion it shows up a second time here as just another sport
  // chip, duplicating that entry.
  const [bySport, todayBySport] = await Promise.all([
    prisma.market.groupBy({
      by: ["sport"],
      where: {
        status: { in: ["OPEN", "SUSPENDED"] },
        sport: { not: "prediction-markets" },
      },
      _count: { _all: true },
      orderBy: { _count: { sport: "desc" } },
    }),
    prisma.market.groupBy({
      by: ["sport"],
      where: {
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["OPEN", "SUSPENDED"] },
        sport: { not: "prediction-markets" },
      },
      _count: { _all: true },
    }),
  ]);

  const todayMap = new Map(todayBySport.map((r) => [r.sport ?? "football", r._count._all]));

  const items = bySport.map((r) => {
    const sport = r.sport ?? "football";
    return {
      sport,
      total: r._count._all,
      live: 0,
      today: todayMap.get(sport) ?? 0,
    };
  });

  return ok({
    items,
    totals: {
      total: items.reduce((sum, item) => sum + item.total, 0),
      live: 0,
      today: items.reduce((sum, item) => sum + item.today, 0),
    },
  });
});
