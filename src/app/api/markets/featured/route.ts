export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma, type Prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const where: Prisma.MarketWhereInput = {
    isFeatured: true,
    status: "OPEN",
  };
  const [rows, total] = await Promise.all([
    prisma.market.findMany({
      where,
      include: { oddsSnapshots: { take: 50, orderBy: { capturedAt: "desc" } } },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
    prisma.market.count({ where }),
  ]);
  const items = rows.map((r) => MarketsRepo.toDto(r));
  return ok({ items, total });
});
