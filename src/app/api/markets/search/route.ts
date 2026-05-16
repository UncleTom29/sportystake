import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return ok({ items: [], total: 0 });
  const s = store();
  const items = s.markets.filter((m) =>
    m.homeTeam.toLowerCase().includes(q) ||
    m.awayTeam.toLowerCase().includes(q) ||
    m.leagueName.toLowerCase().includes(q) ||
    m.country.toLowerCase().includes(q)
  ).slice(0, 25);
  return ok({ items, total: items.length, query: q });
});
