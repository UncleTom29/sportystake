import type { Logger } from 'pino';
import type { IFootballProvider } from '../providers/provider.interface.js';
import type { CacheManager } from '../cache/cache-manager.js';
import type { RedisPublisher } from '../publishers/redis-publisher.js';
import type { QuotaBudgetManager } from '../quota/quota-budget-manager.js';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';
import { normalizeOdds } from '../normalizers/odds.normalizer.js';
import { config } from '../config.js';

/**
 * Refreshes pre-match and live odds every 30 minutes for open/live fixtures.
 * Quota priority is LOW to preserve budget for live polling.
 */
export class OddsRefresherJob {
  constructor(
    private readonly provider: IFootballProvider,
    private readonly cache: CacheManager,
    private readonly publisher: RedisPublisher,
    private readonly quota: QuotaBudgetManager,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<void> {
    const log = this.logger.child({ job: 'odds-refresher' });

    const today = new Date().toISOString().slice(0, 10);
    const fixtures = await this.cache.get<Array<{ fixtureId: number; status: string }>>(
      CacheKeys.fixturesByDate(today),
    );
    if (!fixtures?.length) {
      log.debug('no-fixtures');
      return;
    }

    const targets = fixtures.filter((f) => f.status === 'OPEN' || f.status === 'LIVE');

    for (const f of targets) {
      if (!this.quota.canMakeRequest('low')) {
        log.warn({ remaining: targets.length }, 'quota:stop');
        break;
      }

      const isLive = f.status === 'LIVE';
      const key = isLive
        ? CacheKeys.oddsLive(f.fixtureId)
        : CacheKeys.oddsPrematch(f.fixtureId, config.API_FOOTBALL_BOOKMAKER_ID);
      const minFresh = isLive ? 30 : 600;

      const fresh = await this.cache.isFresh(key, minFresh);
      if (fresh) continue;

      try {
        const raw = isLive
          ? await this.provider.getLiveOdds(f.fixtureId)
          : await this.provider.getOddsByFixture(f.fixtureId);
        await this.quota.recordRequest();
        if (!raw) continue;

        const normalized = normalizeOdds(f.fixtureId, raw, config.API_FOOTBALL_BOOKMAKER_ID);
        if (!normalized) continue;

        const ttl = isLive ? CacheTtl.ODDS_LIVE : CacheTtl.ODDS_PREMATCH;
        await this.cache.set(key, normalized, ttl);
        await this.publisher.publishOddsUpdate(normalized);
        log.debug({ fixtureId: f.fixtureId, isLive }, 'odds:refreshed');
      } catch (err) {
        log.error({ err, fixtureId: f.fixtureId }, 'odds:error');
      }
    }
  }
}
