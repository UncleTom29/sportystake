export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import type { MarketStatus } from "@/lib/types";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") as MarketStatus | null;
  const leagueId = sp.get("leagueId");
  const sport = sp.get("sport");
  const featured = sp.get("featured");
  const parsedLimit = Number(sp.get("limit") ?? "50");
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.trunc(parsedLimit) : 50;
  const offset = Math.max(0, Number(sp.get("offset") ?? "0"));

  const { items, total } = await MarketsRepo.list({
    ...(status ? { status } : {}),
    ...(leagueId ? { leagueId: Number(leagueId) } : {}),
    ...(sport ? { sport } : {}),
    ...(featured ? { featured: true } : {}),
    limit,
    offset,
  });
  return ok({ items, total, offset, limit });
});
