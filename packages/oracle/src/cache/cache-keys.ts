/**
 * Centralized cache keys + TTLs (seconds).
 * Keep ALL Redis keys here so we can change conventions in one place.
 */

export const CacheTtl = {
  FIXTURES_BY_DATE: 600,          // 10m
  FIXTURES_LIVE: 120,             // 2m (matches live-poller interval)
  FIXTURE_DETAIL_LIVE: 120,       // 2m
  FIXTURE_DETAIL_FINISHED: 1800,  // 30m
  ODDS_PREMATCH: 1800,            // 30m
  ODDS_LIVE: 120,                 // 2m
  LIVE_EVENTS: 300,               // 5m — livescores cache (safe margin above 2m cron)
  STANDINGS: 21600,               // 6h (unused, kept for schema compat)
  QUOTA_STATUS: 60,               // 60s
  JOB_HEALTH: 86400,              // 24h — long-lived so staleness is computed
                                   // from the timestamp, not key expiry.
} as const;

export type CacheTtlKey = keyof typeof CacheTtl;

const NS = 'oracle';

export const CacheKeys = {
  fixturesByDate: (date: string): string => `${NS}:fixtures:date:${date}`,
  fixturesLive: (): string => `${NS}:fixtures:live`,
  liveEvents: (): string => `${NS}:live:events`,
  fixtureDetail: (fixtureId: number): string => `${NS}:fixture:${fixtureId}`,
  fixtureBatch: (ids: number[]): string =>
    `${NS}:fixtures:batch:${[...ids].sort((a, b) => a - b).join('-')}`,
  oddsPrematch: (fixtureId: number): string => `${NS}:odds:prematch:${fixtureId}`,
  oddsLive: (fixtureId: number): string => `${NS}:odds:live:${fixtureId}`,
  standings: (leagueId: number, season: number): string =>
    `${NS}:standings:${leagueId}:${season}`,
  quotaStatus: (): string => `${NS}:quota:status`,
  jobHealth: (job: string): string => `${NS}:health:${job}`,
} as const;

/** Shape written by every job on every run (success, empty, or error) so
 *  health can be judged by recency + outcome, not just "did it ever throw". */
export interface JobHealth {
  ts: string;
  ok: boolean;
  rows: number;
  error: string | null;
}

/**
 * Redis pub/sub channel names.
 */
export const Channels = {
  MARKET_SYNC: 'market:sync',
  ODDS_UPDATE: 'odds:update',
  MARKET_LIVE: 'market:live',
  MARKET_FINISHED: 'market:finished',
  QUOTA_ALERT: 'quota:alert',
} as const;

/**
 * Redis list/set keys used by jobs.
 */
export const RedisKeys = {
  LIVE_FIXTURES_SET: `${NS}:fixtures:live:set`,
  ODDS_REFRESH_QUEUE: `${NS}:queue:odds-refresh`,
  SYNCED_FIXTURES_SET: `${NS}:fixtures:synced`,
  UPCOMING_SOON_SET: `${NS}:fixtures:upcoming-soon`,
} as const;
