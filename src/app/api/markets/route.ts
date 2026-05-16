import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const leagueId = sp.get("leagueId");
  const country = sp.get("country");
  const featured = sp.get("featured");
  const sport = sp.get("sport");
  const limit = Math.min(100, Number(sp.get("limit") ?? "50"));
  const offset = Math.max(0, Number(sp.get("offset") ?? "0"));

  const s = store();
  let result = s.markets.slice();
  if (status) result = result.filter((m) => m.status === status);
  if (leagueId) result = result.filter((m) => m.leagueId === Number(leagueId));
  if (country) result = result.filter((m) => m.country.toLowerCase() === country.toLowerCase() || m.countryCode === country);
  if (featured) result = result.filter((m) => m.isFeatured);
  if (sport && sport !== "all") {
    // All seeded markets are football. Filter would apply if we had other sports.
  }
  result = result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const page = result.slice(offset, offset + limit);
  return ok({ items: page, total: result.length, offset, limit });
});
