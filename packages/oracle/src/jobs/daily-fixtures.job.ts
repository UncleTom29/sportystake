import type { Logger } from 'pino';
import type { IFootballProvider } from '../providers/provider.interface.js';
import type { CacheManager } from '../cache/cache-manager.js';
import type { RedisPublisher } from '../publishers/redis-publisher.js';
import type { QuotaBudgetManager } from '../quota/quota-budget-manager.js';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';
import { normalizeFixtures } from '../normalizers/fixture.normalizer.js';

/**
 * Runs at 01:00 UTC daily. Fetches fixtures for today + next 2 days and
 * warms the per-date cache so downstream requests are served from Redis.
 */
export class DailyFixturesJob {
  constructor(
    private readonly provider: IFootballProvider,
    private readonly cache: CacheManager,
    private readonly publisher: RedisPublisher,
    private readonly quota: QuotaBudgetManager,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<void> {
    const log = this.logger.child({ job: 'daily-fixtures' });
    log.info('job:start');

    const dates = [0, 1, 2].map((offset) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    });

    for (const date of dates) {
      if (!this.quota.canMakeRequest('high')) {
        log.warn({ date }, 'quota:skip — not enough budget');
        continue;
      }

      const key = CacheKeys.fixturesByDate(date);
      const fresh = await this.cache.isFresh(key, 300);
      if (fresh) {
        log.debug({ date }, 'cache:fresh');
        continue;
      }

      try {
        const raw = await this.provider.getFixturesByDate(date);
        await this.quota.recordRequest();
        const normalized = normalizeFixtures(raw);
        await this.cache.set(key, normalized, CacheTtl.FIXTURES_BY_DATE);
        await this.publisher.publishFixtureSync(normalized);
        log.info({ date, count: normalized.length }, 'fixtures:synced');
      } catch (err) {
        log.error({ err, date }, 'fixtures:error');
      }
    }

    log.info('job:done');
  }
}
