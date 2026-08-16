import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sport = req.nextUrl.searchParams.get("sport");
  const leagueId = req.nextUrl.searchParams.get("leagueId");
  // Outrights tab: all scheduled fixtures from today through next 30 days.
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const to = new Date(from.getTime() + 30 * 24 * 3_600_000);

  const rows = await prisma.market.findMany({
    where: {
      status: { in: ["OPEN", "SUSPENDED"] },
      startTime: { gte: from, lte: to },
      ...(sport ? { sport } : {}),
      ...(leagueId ? { leagueId: Number(leagueId) } : {}),
    },
    include: { oddsSnapshots: { take: 50, orderBy: { capturedAt: "desc" } } },
    orderBy: { startTime: "asc" },
    take: 200,
  });

  const items = rows.map((r) => MarketsRepo.toDto(r));
  return ok({ items, total: items.length });
});
