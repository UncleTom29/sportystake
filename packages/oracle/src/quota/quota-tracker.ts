import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { CacheKeys, CacheTtl } from '../cache/cache-keys.js';

export interface QuotaSnapshot {
  used: number;
  remaining: number;
  resetAt: string;
}

const HOUR_SECONDS = 60 * 60;

/**
 * Persists hourly quota counters to Redis so multiple oracle instances /
 * restarts stay roughly in sync within the current hour window.
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
        HOUR_SECONDS,
      );
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
