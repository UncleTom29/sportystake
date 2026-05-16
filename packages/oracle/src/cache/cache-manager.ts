import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

export class CacheManager {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn({ err, key }, 'cache:get failed');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, payload);
      }
    } catch (err) {
      this.logger.warn({ err, key }, 'cache:set failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn({ err, key }, 'cache:del failed');
    }
  }

  /**
   * Returns true if a value exists for `key` AND the remaining TTL is
   * greater than `minTtlSeconds`. Useful for deciding whether to refresh.
   */
  async isFresh(key: string, minTtlSeconds = 0): Promise<boolean> {
    try {
      const ttl = await this.redis.ttl(key);
      // -2 = key missing, -1 = no expiry
      if (ttl === -2) return false;
      if (ttl === -1) return true;
      return ttl > minTtlSeconds;
    } catch (err) {
      this.logger.warn({ err, key }, 'cache:isFresh failed');
      return false;
    }
  }

  /**
   * Cache-aside helper. Returns the cached value when present, otherwise
   * invokes `fn`, stores its result with the given TTL and returns it.
   */
  async getOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug({ key }, 'cache:hit');
      return cached;
    }
    this.logger.debug({ key }, 'cache:miss');
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
