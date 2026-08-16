export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

// Leagues whose names contain these fragments are promoted to the top.
const TOP_LEAGUE_FRAGMENTS = [
  "premier league",
  "champions league",
  "la liga",
  "serie a",
  "bundesliga",
  "ligue 1",
  "europa league",
  "world cup",
  "fa cup",
  "nba",
  "nfl",
  "mlb",
  "nhl",
  "atp",
  "wta",
  "grand slam",
  "wimbledon",
  "french open",
  "us open",
  "australian open",
];

function leaguePriority(name: string): number {
  const lower = name.toLowerCase();
  return TOP_LEAGUE_FRAGMENTS.some((f) => lower.includes(f)) ? 0 : 1;
}

/**
 * Aggregated per-league counts. Uses a single SQL groupBy + a second cheap
 * query for today counts so we don't load every market into memory.
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  const sport = _req.nextUrl.searchParams.get("sport");
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [byLeague, todayByLeague] = await Promise.all([
    prisma.market.groupBy({
      by: ["leagueId", "leagueName", "leagueLogo", "country", "countryCode", "sport"],
      where: {
        status: { in: ["OPEN", "SUSPENDED"] },
        ...(sport ? { sport } : {}),
      },
      _count: { _all: true },
    }),
    prisma.market.groupBy({
      by: ["leagueId"],
      where: {
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["OPEN", "SUSPENDED"] },
        ...(sport ? { sport } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const todayMap = new Map(todayByLeague.map((r) => [r.leagueId, r._count._all]));

  const items = byLeague
    .map((r) => ({
      id: r.leagueId,
      name: r.leagueName,
      logo: r.leagueLogo ?? undefined,
      sport: r.sport ?? "football",
      country: r.country,
      countryCode: r.countryCode ?? "",
      matchesToday: todayMap.get(r.leagueId) ?? 0,
      live: 0,
      total: r._count._all,
    }))
    .sort((a, b) => {
      const pa = leaguePriority(a.name);
      const pb = leaguePriority(b.name);
      if (pa !== pb) return pa - pb;
      return b.total - a.total; // then by total count desc
    });

  return ok({ items });
});
