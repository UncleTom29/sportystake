/**
 * XbetLiveJob
 *
 * Runs xbet_live.py every cron tick to fetch all in-play events from
 * 1xbet's LiveFeed, then:
 *   - Caches the full event list in Redis (`oracle:live:events`) so the
 *     /api/livescores endpoint can serve it without hitting the DB.
 *   - Publishes `market:live`     — score / minute tick for every live event
 *   - Publishes `market:finished` — terminal signal for events 1xbet flagged done
 *
 * Re-entrancy guard ensures overlapping invocations are skipped.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Logger } from 'pino';
import type { CacheManager } from '../cache/cache-manager.js';
import type { RedisPublisher } from '../publishers/redis-publisher.js';
import { CacheKeys, CacheTtl, type JobHealth } from '../cache/cache-keys.js';
import { resolvePython3 } from '../python-runtime.js';
import { scraperLiveRowToFixture } from '../normalizers/scrape.normalizer.js';
import { reconcileLiveTracking, type LiveRow, type LiveTrackingState } from './live-tracking.js';

const execFileAsync = promisify(execFile);

export type { LiveRow };

const SCRIPT_TIMEOUT_MS = 120_000;

// If a run is still "in progress" after this long, treat the lock as stale
// rather than skip forever. execFile's own SCRIPT_TIMEOUT_MS bounds the
// scrape itself, but the Redis writes after it aren't bounded the same way
// (an ioredis command can queue indefinitely across a broker restart) — one
// tick stuck there used to wedge every future tick permanently, since
// `running` only resets in a `finally` that a hung await never reaches.
const STALE_LOCK_MS = SCRIPT_TIMEOUT_MS * 3;

export class XbetLiveJob {
  private readonly scriptPath: string;
  private running = false;
  private runningSince = 0;

  constructor(
    private readonly cache: CacheManager,
    private readonly publisher: RedisPublisher,
    private readonly logger: Logger,
  ) {
    this.scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'xbet_live.py');
  }

  async run(): Promise<void> {
    if (this.running) {
      const stuckMs = Date.now() - this.runningSince;
      if (stuckMs < STALE_LOCK_MS) {
        this.logger.debug({ job: 'xbet-live' }, 'job:skip — already running');
        return;
      }
      this.logger.warn(
        { job: 'xbet-live', stuckMs },
        'job:stale-lock — previous run never completed, proceeding anyway',
      );
    }
    this.running = true;
    this.runningSince = Date.now();
    try {
      await this._run(this.logger.child({ job: 'xbet-live' }));
    } catch (err) {
      this.logger.error({ err, job: 'xbet-live' }, 'job:fatal');
    } finally {
      this.running = false;
    }
  }

  private async _run(log: Logger): Promise<void> {
    const t0 = Date.now();

    let rows: LiveRow[] = [];
    try {
      // execFile (async), not execFileSync — keeps the oracle's HTTP server
      // responsive while the scrape is in flight.
      const { stdout } = await execFileAsync(resolvePython3(), [this.scriptPath], {
        timeout: SCRIPT_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024,
      });
      rows = JSON.parse(stdout.toString()) as LiveRow[];
      log.info({ rows: rows.length, ms: Date.now() - t0 }, 'live:scraped');
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 300) ?? String(err);
      log.warn({ err: msg }, 'live:scrape-failed');
      await this.recordHealth({ ok: false, rows: 0, error: msg });
      return;
    }

    // Runs even when `rows` is empty: a genuinely empty tick is real signal
    // that anything previously tracked is now missing too (as opposed to a
    // failed scrape above, which returns before this and correctly leaves
    // tracking untouched — "we don't know" must never count as "missing").
    await this.runDisappearanceTracking(rows, log);

    if (rows.length === 0) {
      log.debug('live:no-events');
      // Still cache empty array so the API doesn't serve stale data. Zero
      // live events is a plausible, non-anomalous state (global lull) —
      // unlike the scraper job, this counts as a healthy run.
      await this.cache.set(CacheKeys.liveEvents(), [], CacheTtl.LIVE_EVENTS);
      await this.recordHealth({ ok: true, rows: 0 });
      return;
    }

    // Cache full event list (including finished ones — frontend can show FT badge).
    await this.cache.set(CacheKeys.liveEvents(), rows, CacheTtl.LIVE_EVENTS);
    log.info({ cached: rows.length }, 'live:cached');

    // Publish settlement/score ticks.
    let live = 0;
    let finished = 0;
    for (const row of rows) {
      const fixtureId = Number.parseInt(row.match_id, 10);
      if (!Number.isFinite(fixtureId)) continue;

      // Full fixture, not just the score/minute tick — a match can go live
      // without ever appearing in a prematch snapshot, so the sync-worker
      // needs enough here to create the Market row, not just update one.
      await this.publisher.publishMarketLive(scraperLiveRowToFixture(row));
      live++;

      if (row.finished) {
        await this.publisher.publishMatchFinished(fixtureId, row.score.home, row.score.away);
        finished++;
      }
    }

    log.info({ live, finished, elapsed: Date.now() - t0 }, 'job:done');
    await this.recordHealth({ ok: true, rows: rows.length });
  }

  /**
   * See live-tracking.ts's doc comment for why this exists: the explicit
   * `row.finished` flag below essentially never fires in practice, so this
   * is what actually resolves most naturally-finished matches instead of
   * leaving them to the 4-hour stuck-market safety net (which can only
   * cancel, having no score of its own to resolve with).
   */
  private async runDisappearanceTracking(rows: LiveRow[], log: Logger): Promise<void> {
    const previous = (await this.cache.get<LiveTrackingState>(CacheKeys.liveTracking())) ?? {};
    const { nextState, inferredFinished } = reconcileLiveTracking(previous, rows);

    for (const f of inferredFinished) {
      log.info(
        { fixtureId: f.fixtureId, homeScore: f.homeScore, awayScore: f.awayScore },
        'live:inferred-finished — disappeared from live feed, resolving with last known score',
      );
      await this.publisher.publishMatchFinished(f.fixtureId, f.homeScore, f.awayScore);
    }

    await this.cache.set(CacheKeys.liveTracking(), nextState, CacheTtl.LIVE_TRACKING);
  }

  private async recordHealth(result: { ok: boolean; rows: number; error?: string }): Promise<void> {
    const health: JobHealth = {
      ts: new Date().toISOString(),
      ok: result.ok,
      rows: result.rows,
      error: result.error ?? null,
    };
    await this.cache.set(CacheKeys.jobHealth('live-poller'), health, CacheTtl.JOB_HEALTH);
  }
}
