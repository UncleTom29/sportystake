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
      `Odds API quota exhausted (priority=${priority}, mode=${status.mode}, remaining=${status.remaining})`,
    );
    this.name = 'QuotaExhaustedError';
    this.status = status;
    this.priority = priority;
  }
}

/** Odds-API.io free plan: 100 requests per hour. */
export const HOURLY_QUOTA = 100;

function modeFor(remaining: number): QuotaMode {
  // Emergency: reserve for live polling only (~6 critical req/hr).
  if (remaining < 8) return 'emergency';
  // Conservation: reserve for discovery + live; block odds (low priority).
  if (remaining < 15) return 'conservation';
  return 'normal';
}

function nextUtcHour(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0, 0, 0,
    ),
  );
}

/**
 * Hourly quota gate for Odds-API.io calls.
 *
 * Call sites MUST:
 *   1. canMakeRequest(priority); skip/throw if false.
 *   2. recordRequest(remainingFromHeader) after every response.
 */
export class QuotaBudgetManager {
  private remaining = HOURLY_QUOTA;
  private used = 0;
  private resetAt: Date = nextUtcHour();
  private currentMode: QuotaMode = 'normal';
  private resetTimer: NodeJS.Timeout | null = null;
  private reconcileInFlight: Promise<void> | null = null;
  private recoveryProbeAvailable = false;

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
        // A previous process may have raced quota header updates and persisted
        // an exhausted snapshot even though the upstream window still has room.
        // Allow exactly one probe request after restart so fresh headers can
        // reconcile the local counters instead of deadlocking at remaining=0.
        this.recoveryProbeAvailable = persisted.remaining <= 0;
      } else {
        await this.performReset('stale-snapshot');
      }
    }
    this.currentMode = modeFor(this.remaining);
    this.scheduleHourlyReset();
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
   *   remaining <= 0   → no requests
   *   remaining < 8    → critical only  (live polling)
   *   remaining < 15   → high + critical (discovery + live; no odds)
   *   otherwise        → allow all
   */
  canMakeRequest(priority: Priority): boolean {
    this.reconcileIfWindowExpired();
    if (this.remaining <= 0 && this.recoveryProbeAvailable) {
      this.logger.warn(
        { priority, resetAt: this.resetAt.toISOString() },
        'quota:allowing-recovery-probe',
      );
      return true;
    }
    if (this.remaining <= 0) return false;
    if (this.remaining < 5) return priority === 'critical';
    if (this.remaining < 10) return priority !== 'low';
    return true;
  }

  /**
   * Update counters from the upstream x-ratelimit-remaining header.
   * If the header is missing, decrement locally.
   */
  async recordRequest(remainingFromHeader?: number | string | null): Promise<QuotaStatus> {
    this.reconcileIfWindowExpired();
    this.recoveryProbeAvailable = false;
    const parsed =
      remainingFromHeader === undefined || remainingFromHeader === null
        ? Number.NaN
        : Number(remainingFromHeader);

    if (Number.isFinite(parsed)) {
      this.remaining = Math.max(0, Math.min(HOURLY_QUOTA, Math.trunc(parsed)));
      this.used = Math.max(0, HOURLY_QUOTA - this.remaining);
    } else {
      this.remaining = Math.max(0, this.remaining - 1);
      this.used = Math.min(HOURLY_QUOTA, this.used + 1);
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
    this.reconcileIfWindowExpired();
    return {
      used: this.used,
      remaining: this.remaining,
      resetAt: this.resetAt.toISOString(),
      mode: this.currentMode,
    };
  }

  private scheduleHourlyReset(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    const now = Date.now();
    const delay = Math.max(1_000, this.resetAt.getTime() - now);
    this.resetTimer = setTimeout(() => {
      void this.performReset('scheduled').then(() => this.scheduleHourlyReset());
    }, delay);
    if (typeof this.resetTimer.unref === 'function') this.resetTimer.unref();
  }

  private reconcileIfWindowExpired(): void {
    if (Date.now() < this.resetAt.getTime()) return;

    const previousMode = this.currentMode;
    this.remaining = HOURLY_QUOTA;
    this.used = 0;
    this.resetAt = nextUtcHour();
    this.currentMode = 'normal';
    this.scheduleHourlyReset();

    if (!this.reconcileInFlight) {
      this.reconcileInFlight = (async () => {
        try {
          await this.tracker.save({
            used: this.used,
            remaining: this.remaining,
            resetAt: this.resetAt.toISOString(),
          });
          if (previousMode !== 'normal') {
            await this.broadcastAlert(previousMode, 'normal');
          }
          this.logger.info(
            {
              used: this.used,
              remaining: this.remaining,
              mode: this.currentMode,
              resetAt: this.resetAt.toISOString(),
            },
            'quota:reconciled-expired-window',
          );
        } finally {
          this.reconcileInFlight = null;
        }
      })();
    }
  }

  async performReset(reason: string): Promise<void> {
    const previousMode = this.currentMode;
    this.remaining = HOURLY_QUOTA;
    this.used = 0;
    this.resetAt = nextUtcHour();
    this.currentMode = 'normal';
    this.recoveryProbeAvailable = false;
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
