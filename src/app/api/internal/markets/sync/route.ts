import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireInternalKey } from "@/lib/server/auth";
import { redisPublisher } from "@/lib/server/redis";

export const runtime = "nodejs";

interface NormalizedFixture {
  fixtureId: number;
  externalId: string;
  sport?: string;
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  country: string;
  countryCode: string | null;
  season: number;
  round: string;
  homeTeam: string; homeTeamId: number; homeTeamLogo: string;
  awayTeam: string; awayTeamId: number; awayTeamLogo: string;
  startTime: string;
  status: "OPEN" | "LIVE" | "FINISHED" | "CANCELLED";
  rawStatus: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  venue: string | null;
}

/**
 * Backfill / manual fixture push. Forwards onto the same Redis channel the
 * oracle uses so the oracle-sync worker handles persistence consistently.
 *
 * The oracle no longer calls this in normal operation — it publishes
 * directly to Redis. Retained as an ops escape hatch for testing.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const body = (await req.json()) as { fixtures: NormalizedFixture[] };
  const fixtures = body.fixtures ?? [];
  if (fixtures.length > 0) {
    await redisPublisher().publish("market:sync", JSON.stringify({
      type: "fixtures:synced",
      count: fixtures.length,
      fixtures,
      ts: new Date().toISOString(),
    }));
  }
  return ok({ count: fixtures.length });
});
