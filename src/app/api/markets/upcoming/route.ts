export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sport = req.nextUrl.searchParams.get("sport") ?? undefined;
  const leagueIdStr = req.nextUrl.searchParams.get("leagueId");
  const leagueId = leagueIdStr ? Number(leagueIdStr) : undefined;

  const { items, total } = await MarketsRepo.list({
    ...(sport ? { sport } : {}),
    ...(leagueId ? { leagueId } : {}),
    limit: 500,
  });

  return ok({ items, total });
});
