import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";
import type { MarketDTO } from "@/lib/types";
import { shortId } from "@/lib/uid";

export const runtime = "nodejs";

const Body = z.object({
  externalId: z.string(),
  leagueId: z.number().int(),
  leagueName: z.string(),
  country: z.string(),
  countryCode: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  startTime: z.string(),
  isFeatured: z.boolean().default(false),
});

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  return ok({ items: store().markets });
});

export const POST = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
  const s = store();
  const m: MarketDTO = {
    id: `mkt-${shortId()}`,
    externalId: parsed.data.externalId,
    fixtureId: Date.now() % 9_999_999,
    leagueId: parsed.data.leagueId,
    leagueName: parsed.data.leagueName,
    country: parsed.data.country,
    countryCode: parsed.data.countryCode,
    homeTeam: parsed.data.homeTeam,
    homeTeamId: 0,
    awayTeam: parsed.data.awayTeam,
    awayTeamId: 0,
    startTime: parsed.data.startTime,
    status: "OPEN",
    poolAddress: utils.randAddr(),
    poolTvl: "0.000000",
    poolLocked: "0.000000",
    poolBetVolume: "0.000000",
    isFeatured: parsed.data.isFeatured,
    odds: [],
    marketsCount: 0,
  };
  s.markets.push(m);
  return ok(m, { status: 201 });
});
