import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';

export interface QuotaSnapshot {
  used: number;
  remaining: number;
  resetAt: string;
}

const DAY_SECONDS = 60 * 60 * 24;

/**
 * Persists quota counters to Redis so multiple oracle instances / restarts
 * stay roughly in sync within a 24h window.
 */
export class QuotaTracker {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<QuotaSnapshot | null> {
    try {
      const raw = await this.redis.get(CacheKeys.quotaStatus());
      if (!raw) return null;
      return JSON.parse(raw) as QuotaSnapshot;
    } catch (err) {
      this.logger.warn({ err }, 'quota-tracker:load failed');
      return null;
    }
  }

  async save(snapshot: QuotaSnapshot): Promise<void> {
    try {
      await this.redis.set(
        CacheKeys.quotaStatus(),
        JSON.stringify(snapshot),
        'EX',
        DAY_SECONDS,
      );
      // Short-lived mirror used by health/status consumers.
      await this.redis.set(
        `${CacheKeys.quotaStatus()}:hot`,
        JSON.stringify(snapshot),
        'EX',
        CacheTtl.QUOTA_STATUS,
      );
    } catch (err) {
      this.logger.warn({ err }, 'quota-tracker:save failed');
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.del(CacheKeys.quotaStatus());
      await this.redis.del(`${CacheKeys.quotaStatus()}:hot`);
    } catch (err) {
      this.logger.warn({ err }, 'quota-tracker:clear failed');
    }
  }
}
