import type { Logger } from 'pino';
import type { IFootballProvider } from '../providers/provider.interface.js';
import type { CacheManager } from '../cache/cache-manager.js';
import type { RedisPublisher } from '../publishers/redis-publisher.js';
import type { QuotaBudgetManager } from '../quota/quota-budget-manager.js';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';
import { normalizeFixtures } from '../normalizers/fixture.normalizer.js';
import { isFinished } from '../normalizers/status-map.js';

/**
 * Polls live fixtures every 45 seconds while matches are in-progress.
 * Publishes score/status updates to Redis channels consumed by the API.
 */
export class LivePollerJob {
  private running = false;

  constructor(
    private readonly provider: IFootballProvider,
    private readonly cache: CacheManager,
    private readonly publisher: RedisPublisher,
    private readonly quota: QuotaBudgetManager,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const log = this.logger.child({ job: 'live-poller' });

    if (!this.quota.canMakeRequest('critical')) {
      log.warn('quota:skip');
      this.running = false;
      return;
    }

    try {
      const raw = await this.provider.getLiveFixtures();
      await this.quota.recordRequest();

      if (raw.length === 0) {
        log.debug('no-live-fixtures');
        this.running = false;
        return;
      }

      const fixtures = normalizeFixtures(raw);
      await this.cache.set(CacheKeys.fixturesLive(), fixtures, CacheTtl.FIXTURES_LIVE);

      for (const f of fixtures) {
        await this.cache.set(
          CacheKeys.fixtureDetail(f.fixtureId),
          f,
          CacheTtl.FIXTURE_DETAIL_LIVE,
        );
        await this.publisher.publishMarketLive(f);

        if (isFinished(f.rawStatus)) {
          await this.publisher.publishMarketFinished(f);
          log.info({ fixtureId: f.fixtureId }, 'market:finished');
        }
      }

      log.debug({ count: fixtures.length }, 'live:polled');
    } catch (err) {
      log.error({ err }, 'live-poller:error');
    } finally {
      this.running = false;
    }
  }
}
