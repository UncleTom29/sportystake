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

  async publishFixtureSync(fixtures: NormalizedFixture[]): Promise<void> {
    await this.publish(Channels.MARKET_SYNC, {
      type: 'fixtures:synced',
      count: fixtures.length,
      fixtures,
    });
  }

  async publishOddsUpdate(odds: NormalizedOdds): Promise<void> {
    await this.publish(Channels.ODDS_UPDATE, {
      type: 'odds:updated',
      fixtureId: odds.fixtureId,
      markets: odds.markets,
    });
  }

  async publishMarketLive(fixture: NormalizedFixture): Promise<void> {
    await this.publish(Channels.MARKET_LIVE, {
      type: 'market:live',
      fixtureId: fixture.fixtureId,
      minute: fixture.minute,
      score: { home: fixture.homeScore, away: fixture.awayScore },
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
    });
  }

  async publishMarketFinished(fixture: NormalizedFixture): Promise<void> {
    await this.publish(Channels.MARKET_FINISHED, {
      type: 'market:finished',
      fixtureId: fixture.fixtureId,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
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
