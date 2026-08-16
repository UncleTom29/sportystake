/**
 * Thin proxy to the oracle service. All fixture/odds reads in the Next.js
 * route layer should go through here so caching, retries, and auth are
 * centralized.
 *
 * Two read paths are supported:
 *   1. Direct Redis read (preferred — same cache the oracle writes to).
 *   2. HTTP fallback to the oracle's internal API endpoints (handy for
 *      cross-host deployments where the app can't see Redis directly).
 */
import { serverEnv } from "@/lib/env";
import { redis } from "./redis";

const FIXTURES_LIVE_KEY = "oracle:fixtures:live";
const FIXTURES_BY_DATE = (date: string) => `oracle:fixtures:date:${date}`;
const ODDS_LIVE = (id: number) => `oracle:odds:live:${id}`;
const ODDS_PREMATCH = (id: number, bm = 6) => `oracle:odds:prematch:${bm}:${id}`;
const QUOTA_KEY = "oracle:quota:status";

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function httpFallback<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${serverEnv.ORACLE_INTERNAL_API_URL}${path}`, {
      headers: { "x-oracle-key": serverEnv.ORACLE_INTERNAL_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface OracleFixture {
  fixtureId: number;
  externalId: string;
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  country: string;
  homeTeam: string;
  homeTeamId: number;
  homeTeamLogo: string;
  awayTeam: string;
  awayTeamId: number;
  awayTeamLogo: string;
  startTime: string;
  status: "OPEN" | "LIVE" | "FINISHED" | "CANCELLED";
  rawStatus: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
}

export const Oracle = {
  async liveFixtures(): Promise<OracleFixture[]> {
    const fromRedis = await readJson<OracleFixture[]>(FIXTURES_LIVE_KEY);
    if (fromRedis) return fromRedis;
    const fromHttp = await httpFallback<{ fixtures: OracleFixture[] }>(
      "/internal/fixtures/live",
    );
    return fromHttp?.fixtures ?? [];
  },

  async fixturesByDate(date: string): Promise<OracleFixture[]> {
    const fromRedis = await readJson<OracleFixture[]>(FIXTURES_BY_DATE(date));
    if (fromRedis) return fromRedis;
    const fromHttp = await httpFallback<{ fixtures: OracleFixture[] }>(
      `/internal/fixtures/by-date/${encodeURIComponent(date)}`,
    );
    return fromHttp?.fixtures ?? [];
  },

  async oddsForFixture(fixtureId: number): Promise<{ live: unknown; prematch: unknown }> {
    const [live, prematch] = await Promise.all([
      readJson(ODDS_LIVE(fixtureId)),
      readJson(ODDS_PREMATCH(fixtureId)),
    ]);
    if (live || prematch) return { live, prematch };
    const fromHttp = await httpFallback<{ live: unknown; prematch: unknown }>(
      `/internal/odds/${fixtureId}`,
    );
    return fromHttp ?? { live: null, prematch: null };
  },

  async quotaStatus(): Promise<{ used: number; remaining: number; resetAt: string; mode: string } | null> {
    return readJson(QUOTA_KEY);
  },
};
