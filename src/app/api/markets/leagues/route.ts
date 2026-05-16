import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const byLeague = new Map<number, { id: number; name: string; logo?: string; country: string; countryCode: string; matchesToday: number; live: number; total: number }>();
  const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
  for (const m of s.markets) {
    const e = byLeague.get(m.leagueId) ?? {
      id: m.leagueId, name: m.leagueName, logo: m.leagueLogo, country: m.country, countryCode: m.countryCode,
      matchesToday: 0, live: 0, total: 0,
    };
    e.total++;
    if (m.status === "LIVE") e.live++;
    if (new Date(m.startTime).getTime() <= todayEnd.getTime() && m.status !== "SETTLED") e.matchesToday++;
    byLeague.set(m.leagueId, e);
  }
  return ok({ items: Array.from(byLeague.values()).sort((a, b) => b.total - a.total) });
});
