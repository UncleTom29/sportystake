export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sport = req.nextUrl.searchParams.get("sport");
  const leagueId = req.nextUrl.searchParams.get("leagueId");
  const items = await MarketsRepo.live(sport ?? undefined, leagueId ? Number(leagueId) : undefined);
  items.sort((a, b) => (b.liveMinute ?? 0) - (a.liveMinute ?? 0));
  return ok({ items, total: items.length });
});
