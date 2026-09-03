import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { MarketStatus } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
    throw new ApiError("Forbidden", "Admin or Operator access required", 403);
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") as MarketStatus | null;
  const search = searchParams.get("q") || "";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const where = {
    ...(statusParam && Object.values(MarketStatus).includes(statusParam) ? { status: statusParam } : {}),
    ...(search
      ? {
          OR: [
            { homeTeam: { contains: search, mode: "insensitive" as const } },
            { awayTeam: { contains: search, mode: "insensitive" as const } },
            { leagueName: { contains: search, mode: "insensitive" as const } },
            { id: { equals: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { bets: true } },
      },
    }),
    prisma.market.count({ where }),
  ]);

  return ok({
    items: items.map((m: any) => ({
      ...m,
      startTime: m.startTime.toISOString(),
      closesAt: m.closesAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      fixtureId: Number(m.fixtureId),
      homeTeamId: Number(m.homeTeamId),
      awayTeamId: Number(m.awayTeamId),
      betsCount: m._count.bets,
    })),
    total,
    limit,
    offset,
  });
});
