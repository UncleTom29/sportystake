import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length === 0) return ok({ items: [], total: 0, query: q });
  if (q.length > 80) return ok({ items: [], total: 0, query: q });

  const rows = await prisma.market.findMany({
    where: {
      OR: [
        { homeTeam: { contains: q, mode: "insensitive" } },
        { awayTeam: { contains: q, mode: "insensitive" } },
        { leagueName: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { oddsSnapshots: { take: 50, orderBy: { capturedAt: "desc" } } },
    orderBy: { startTime: "asc" },
    take: 25,
  });
  const items = rows.map((r) => MarketsRepo.toDto(r));
  return ok({ items, total: items.length, query: q });
});
