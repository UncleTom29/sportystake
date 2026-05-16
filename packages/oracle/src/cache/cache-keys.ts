/**
 * Centralized cache keys + TTLs (seconds).
 * Keep ALL Redis keys here so we can change conventions in one place.
 */

export const CacheTtl = {
  FIXTURES_BY_DATE: 600, // 10m
  FIXTURES_LIVE: 45, // 45s
  FIXTURE_DETAIL_LIVE: 120, // 2m
  FIXTURE_DETAIL_FINISHED: 1800, // 30m
  ODDS_PREMATCH: 1800, // 30m
  ODDS_LIVE: 90, // 90s
  PREDICTION: 86400, // 24h
  STANDINGS: 21600, // 6h
  H2H: 86400, // 24h
  QUOTA_STATUS: 60, // 60s
} as const;

export type CacheTtlKey = keyof typeof CacheTtl;

const NS = 'oracle';

export const CacheKeys = {
  fixturesByDate: (date: string): string => `${NS}:fixtures:date:${date}`,
  fixturesLive: (): string => `${NS}:fixtures:live`,
  fixtureDetail: (fixtureId: number): string => `${NS}:fixture:${fixtureId}`,
  fixtureBatch: (ids: number[]): string =>
    `${NS}:fixtures:batch:${[...ids].sort((a, b) => a - b).join('-')}`,
  oddsPrematch: (fixtureId: number, bookmakerId: number): string =>
    `${NS}:odds:prematch:${bookmakerId}:${fixtureId}`,
  oddsLive: (fixtureId: number): string => `${NS}:odds:live:${fixtureId}`,
  prediction: (fixtureId: number): string => `${NS}:prediction:${fixtureId}`,
  standings: (leagueId: number, season: number): string =>
    `${NS}:standings:${leagueId}:${season}`,
  h2h: (homeId: number, awayId: number): string => {
    const [a, b] = [homeId, awayId].sort((x, y) => x - y);
    return `${NS}:h2h:${a}-${b}`;
  },
  quotaStatus: (): string => `${NS}:quota:status`,
} as const;

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
