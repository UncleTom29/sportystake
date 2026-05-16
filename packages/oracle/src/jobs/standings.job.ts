import type { Logger } from 'pino';
import type { IFootballProvider } from '../providers/provider.interface.js';
import type { CacheManager } from '../cache/cache-manager.js';
import type { QuotaBudgetManager } from '../quota/quota-budget-manager.js';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';

const TRACKED_LEAGUES = [
  { id: 39,  season: 2025 },
  { id: 140, season: 2025 },
  { id: 135, season: 2025 },
  { id: 78,  season: 2025 },
  { id: 61,  season: 2025 },
  { id: 2,   season: 2025 },
] as const;

/**
 * Refreshes league standings every 6 hours.
 * Uses LOW quota priority since standings data is not time-critical.
 */
export class StandingsJob {
  constructor(
    private readonly provider: IFootballProvider,
    private readonly cache: CacheManager,
    private readonly quota: QuotaBudgetManager,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<void> {
    const log = this.logger.child({ job: 'standings' });
    log.info('job:start');

    for (const { id, season } of TRACKED_LEAGUES) {
      if (!this.quota.canMakeRequest('low')) {
        log.warn('quota:stop');
        break;
      }

      const key = CacheKeys.standings(id, season);
      const fresh = await this.cache.isFresh(key, 3600);
      if (fresh) {
        log.debug({ leagueId: id }, 'cache:fresh');
        continue;
      }

      try {
        const standings = await this.provider.getStandings(id, season);
        await this.quota.recordRequest();
        if (standings) {
          await this.cache.set(key, standings, CacheTtl.STANDINGS);
          log.info({ leagueId: id, season }, 'standings:synced');
        }
      } catch (err) {
        log.error({ err, leagueId: id }, 'standings:error');
      }
    }

    log.info('job:done');
  }
}
