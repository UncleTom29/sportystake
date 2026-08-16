import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sport = req.nextUrl.searchParams.get("sport");
  const leagueId = req.nextUrl.searchParams.get("leagueId");

  const now = new Date();
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const tomorrowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999));

  const rows = await prisma.market.findMany({
    where: {
      status: { in: ["OPEN", "SUSPENDED"] },
      startTime: { gte: tomorrowStart, lte: tomorrowEnd },
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
