import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Channels } from '../cache/cache-keys.js';
import type { NormalizedFixture } from '../normalizers/fixture.normalizer.js';
import type { NormalizedOdds } from '../normalizers/odds.normalizer.js';

export class RedisPublisher {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async publishFixtureSync(
    fixtures: NormalizedFixture[],
    opts: { isFullSync?: boolean } = {},
  ): Promise<void> {
    // isFullSync=true means this payload is the complete current snapshot —
    // the sync-worker can sweep any OPEN market not present in `fixtures`
    // (provided it has no bets / parlay legs / LP positions).
    await this.publish(Channels.MARKET_SYNC, {
      type: 'fixtures:synced',
      count: fixtures.length,
      isFullSync: opts.isFullSync === true,
      fixtures,
    });
  }

  async publishOddsUpdate(odds: NormalizedOdds): Promise<void> {
    await this.publish(Channels.ODDS_UPDATE, {
      type: 'odds:updated',
      fixtureId: odds.fixtureId,
      bookmaker: odds.bookmakerName,
      markets: odds.markets,
    });
  }

  /** Publishes the full fixture (not just score/minute) so the sync-worker
   *  can create the Market row on the spot if this is the first time we've
   *  seen it — a fixture can go live without ever appearing in a prematch
   *  snapshot first. */
  async publishMarketLive(fixture: NormalizedFixture): Promise<void> {
    await this.publish(Channels.MARKET_LIVE, {
      type: 'market:live',
      fixture,
    });
  }

  async publishMarketFinished(fixture: NormalizedFixture): Promise<void> {
    await this.publishMatchFinished(fixture.fixtureId, fixture.homeScore, fixture.awayScore);
  }

  async publishMatchFinished(
    fixtureId: number,
    homeScore: number,
    awayScore: number,
  ): Promise<void> {
    await this.publish(Channels.MARKET_FINISHED, {
      type: 'market:finished',
      fixtureId,
      homeScore,
      awayScore,
    });
  }

  private async publish(channel: string, payload: unknown): Promise<void> {
    try {
      const msg = JSON.stringify({ ...payload as object, ts: new Date().toISOString() });
      await this.redis.publish(channel, msg);
      this.logger.debug({ channel }, 'redis:publish');
    } catch (err) {
      this.logger.warn({ err, channel }, 'redis:publish failed');
    }
  }
}
