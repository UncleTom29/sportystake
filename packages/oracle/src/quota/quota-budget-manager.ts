import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Channels } from '../cache/cache-keys.js';
import { QuotaTracker, type QuotaSnapshot } from './quota-tracker.js';

export type Priority = 'critical' | 'high' | 'low';
export type QuotaMode = 'normal' | 'conservation' | 'emergency';

export interface QuotaStatus {
  used: number;
  remaining: number;
  resetAt: string;
  mode: QuotaMode;
}

export class QuotaExhaustedError extends Error {
  public readonly status: QuotaStatus;
  public readonly priority: Priority;

  constructor(priority: Priority, status: QuotaStatus) {
    super(
      `API-Football quota exhausted (priority=${priority}, mode=${status.mode}, remaining=${status.remaining})`,
    );
    this.name = 'QuotaExhaustedError';
    this.status = status;
    this.priority = priority;
  }
}

export const DAILY_QUOTA = 100;

function modeFor(remaining: number): QuotaMode {
  if (remaining < 5) return 'emergency';
  if (remaining < 15) return 'conservation';
  return 'normal';
}

function nextUtcMidnight(now = new Date()): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return next;
}

/**
 * The single gateway for API-Football calls.
 *
 * Call sites MUST:
 *   1. await canMakeRequest(priority); throw if false.
 *   2. recordRequest(remainingFromHeader) after every response.
 */
export class QuotaBudgetManager {
  private remaining = DAILY_QUOTA;
  private used = 0;
  private resetAt: Date = nextUtcMidnight();
  private currentMode: QuotaMode = 'normal';
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly tracker: QuotaTracker = new QuotaTracker(redis, logger),
  ) {}

  async init(): Promise<void> {
    const persisted = await this.tracker.load();
    if (persisted) {
      const resetAt = new Date(persisted.resetAt);
      if (resetAt.getTime() > Date.now()) {
        this.remaining = persisted.remaining;
        this.used = persisted.used;
        this.resetAt = resetAt;
      } else {
        await this.performReset('stale-snapshot');
      }
    }
    this.currentMode = modeFor(this.remaining);
    this.scheduleDailyReset();
    this.logger.info(
      {
        used: this.used,
        remaining: this.remaining,
        mode: this.currentMode,
        resetAt: this.resetAt.toISOString(),
      },
      'quota:initialized',
    );
  }

  stop(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Priority gate:
   *   remaining <= 0           → no requests
   *   remaining < 5            → critical only
   *   remaining < 15           → no low priority
   *   otherwise                → allow
   */
  canMakeRequest(priority: Priority): boolean {
    if (this.remaining <= 0) return false;
    if (this.remaining < 5) return priority === 'critical';
    if (this.remaining < 15) return priority !== 'low';
    return true;
  }

  /**
   * Update counters from the upstream `x-ratelimit-requests-remaining` header.
   * If the header is missing, decrement locally.
   */
  async recordRequest(remainingFromHeader?: number | string | null): Promise<QuotaStatus> {
    const parsed =
      remainingFromHeader === undefined || remainingFromHeader === null
        ? Number.NaN
        : Number(remainingFromHeader);

    if (Number.isFinite(parsed)) {
      // Trust the upstream header. Never let local view go above DAILY_QUOTA.
      this.remaining = Math.max(0, Math.min(DAILY_QUOTA, Math.trunc(parsed)));
      this.used = Math.max(0, DAILY_QUOTA - this.remaining);
    } else {
      this.remaining = Math.max(0, this.remaining - 1);
      this.used = Math.min(DAILY_QUOTA, this.used + 1);
    }

    const previousMode = this.currentMode;
    const newMode = modeFor(this.remaining);
    this.currentMode = newMode;

    const snapshot: QuotaSnapshot = {
      used: this.used,
      remaining: this.remaining,
      resetAt: this.resetAt.toISOString(),
    };
    await this.tracker.save(snapshot);

    if (newMode !== previousMode) {
      await this.broadcastAlert(previousMode, newMode);
    }

    return this.getStatus();
  }

  getStatus(): QuotaStatus {
    return {
      used: this.used,
      remaining: this.remaining,
      resetAt: this.resetAt.toISOString(),
      mode: this.currentMode,
    };
  }

  /**
   * Schedule the next reset at 00:00 UTC. Re-arms itself after firing.
   */
  private scheduleDailyReset(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    const now = Date.now();
    const delay = Math.max(1_000, this.resetAt.getTime() - now);
    this.resetTimer = setTimeout(() => {
      void this.performReset('scheduled').then(() => this.scheduleDailyReset());
    }, delay);
    // Allow the process to exit even if this timer is pending.
    if (typeof this.resetTimer.unref === 'function') this.resetTimer.unref();
  }

  /**
   * Manually triggerable (also called by the scheduler at 00:00 UTC).
   */
  async performReset(reason: string): Promise<void> {
    const previousMode = this.currentMode;
    this.remaining = DAILY_QUOTA;
    this.used = 0;
    this.resetAt = nextUtcMidnight();
    this.currentMode = 'normal';
    await this.tracker.save({
      used: this.used,
      remaining: this.remaining,
      resetAt: this.resetAt.toISOString(),
    });
    if (previousMode !== this.currentMode) {
      await this.broadcastAlert(previousMode, this.currentMode);
    }
    this.logger.info({ reason, resetAt: this.resetAt.toISOString() }, 'quota:reset');
  }

  private async broadcastAlert(from: QuotaMode, to: QuotaMode): Promise<void> {
    const payload = {
      type: 'quota:mode-changed',
      from,
      to,
      status: this.getStatus(),
      at: new Date().toISOString(),
    };
    try {
      await this.redis.publish(Channels.QUOTA_ALERT, JSON.stringify(payload));
      this.logger.warn(payload, 'quota:mode-changed');
    } catch (err) {
      this.logger.warn({ err }, 'quota:broadcast failed');
    }
  }
}
