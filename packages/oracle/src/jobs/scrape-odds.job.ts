/**
 * ScrapeOddsJob
 *
 * Runs the 1xbet scraper (xbet_full.py) every cron tick and pushes the result
 * into the standard oracle Redis channels:
 *
 *   - `market:sync`   — full snapshot of every prematch fixture currently on
 *                       1xbet (with `isFullSync: true` so the sync-worker can
 *                       sweep stale markets that aren't in the snapshot).
 *   - `odds:update`   — one event per fixture carrying every market group we
 *                       were able to parse (1X2, totals at every line, BTTS,
 *                       DNB, half-time, asian handicaps, team totals…).
 *
 * Single-provider design (1xbet only) — no cross-source dedup, no nuclear
 * fallback to odds-api. Refer to xbet_full.py for the scraping details.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Logger } from 'pino';
import type { CacheManager } from '../cache/cache-manager.js';
import type { RedisPublisher } from '../publishers/redis-publisher.js';
import { CacheKeys, CacheTtl, type JobHealth } from '../cache/cache-keys.js';
import { resolvePython3 } from '../python-runtime.js';
import {
  scraperRowToFixture,
  scraperRowToOdds,
  type ScraperRow,
} from '../normalizers/scrape.normalizer.js';
import type { NormalizedFixture } from '../normalizers/fixture.normalizer.js';

const execFileAsync = promisify(execFile);

/** Python scraper runtime ceiling. Comfortably above the observed ~90 s. */
const SCRAPER_TIMEOUT_MS = 240_000;

/** Fixture-by-date cache TTL. 2× cron interval so stale data self-expires
 *  if the scraper goes down for a tick. */
const FIXTURE_TTL_S = 600;

// See XbetLiveJob's identical constant for why this exists: the Redis
// writes after the scrape aren't bounded by SCRAPER_TIMEOUT_MS, so a broker
// restart mid-write can otherwise wedge `running` true forever.
const STALE_LOCK_MS = SCRAPER_TIMEOUT_MS * 3;

export class ScrapeOddsJob {
  private readonly scriptPath: string;
  private running = false;
  private runningSince = 0;

  constructor(
    private readonly cache: CacheManager,
    private readonly publisher: RedisPublisher,
    private readonly logger: Logger,
  ) {
    // __dirname is available in CJS output (no "type":"module" in package.json).
    this.scriptPath = path.resolve(
      __dirname, '..', '..', 'scripts', 'xbet_full.py',
    );
  }

  async run(): Promise<void> {
    if (this.running) {
      const stuckMs = Date.now() - this.runningSince;
      if (stuckMs < STALE_LOCK_MS) {
        this.logger.debug({ job: 'scrape-odds' }, 'job:skip — already running');
        return;
      }
      this.logger.warn(
        { job: 'scrape-odds', stuckMs },
        'job:stale-lock — previous run never completed, proceeding anyway',
      );
    }
    this.running = true;
    this.runningSince = Date.now();
    try {
      await this._run(this.logger.child({ job: 'scrape-odds' }));
    } catch (err) {
      this.logger.error({ err, job: 'scrape-odds' }, 'job:fatal');
    } finally {
      this.running = false;
    }
  }

  // ─── Private implementation ─────────────────────────────────────────────

  private async _run(log: Logger): Promise<void> {
    const t0 = Date.now();
    log.info({ script: this.scriptPath }, 'job:start');

    // ── 1. Run Python scraper ──────────────────────────────────────────────
    let rows: ScraperRow[] = [];
    try {
      // execFile (async), not execFileSync — the sync form blocks Node's
      // entire event loop for the whole scrape (~90-140s), during which the
      // oracle's HTTP server — including /status and /health — goes dark.
      const { stdout } = await execFileAsync(resolvePython3(), [this.scriptPath], {
        timeout: SCRAPER_TIMEOUT_MS,
        maxBuffer: 200 * 1024 * 1024,
      });
      rows = JSON.parse(stdout.toString()) as ScraperRow[];
      log.info({ rows: rows.length, ms: Date.now() - t0 }, 'scraper:ok');
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 300) ?? String(err);
      log.warn({ err: msg }, 'scraper:failed');
      // Don't sweep on failure — better to keep stale data than nuke the
      // board over a transient scraper outage.
      await this.recordHealth({ ok: false, rows: 0, error: msg });
      return;
    }

    if (rows.length === 0) {
      log.warn('scraper:empty — skipping publish');
      await this.recordHealth({ ok: false, rows: 0, error: 'scraper returned 0 rows' });
      return;
    }

    // ── 2. Build fixture list (single provider → no dedup needed) ──────────
    const fixtures: NormalizedFixture[] = [];
    const seenIds = new Set<number>();
    for (const row of rows) {
      const fid = Number.parseInt(row.match_id, 10);
      if (!Number.isFinite(fid) || seenIds.has(fid)) continue;
      seenIds.add(fid);
      fixtures.push(scraperRowToFixture(row));
    }

    // ── 3. Cache by date + publish a single full snapshot ──────────────────
    const byDate = new Map<string, NormalizedFixture[]>();
    for (const f of fixtures) {
      const d = (f.startTime instanceof Date
        ? f.startTime
        : new Date(f.startTime as unknown as string)
      ).toISOString().slice(0, 10);
      const bucket = byDate.get(d) ?? [];
      bucket.push(f);
      byDate.set(d, bucket);
    }
    for (const [date, dateFix] of byDate) {
      await this.cache.set(CacheKeys.fixturesByDate(date), dateFix, FIXTURE_TTL_S);
    }
    // Single full-snapshot publish — `isFullSync: true` signals the sync-worker
    // to mark-and-sweep markets that aren't in this snapshot (skipping any with
    // open bets / parlay legs / LP positions).
    await this.publisher.publishFixtureSync(fixtures, { isFullSync: true });
    log.info({ fixtures: fixtures.length, dates: byDate.size }, 'fixtures:published');

    // ── 4. Publish odds per fixture (every market the scraper found) ───────
    let oddsPublished = 0;
    let oddsSkipped  = 0;
    for (const row of rows) {
      const odds = scraperRowToOdds(row);
      const x2 = odds.markets.find((m) => m.market === '1X2');
      if (!x2 || x2.outcomes.length < 2) { oddsSkipped++; continue; }
      await this.publisher.publishOddsUpdate(odds);
      oddsPublished++;
    }

    const elapsed = Date.now() - t0;
    log.info({ oddsPublished, oddsSkipped, fixtures: fixtures.length, elapsed }, 'job:done');
    await this.recordHealth({ ok: true, rows: rows.length });
  }

  private async recordHealth(result: { ok: boolean; rows: number; error?: string }): Promise<void> {
    const health: JobHealth = {
      ts: new Date().toISOString(),
      ok: result.ok,
      rows: result.rows,
      error: result.error ?? null,
    };
    await this.cache.set(CacheKeys.jobHealth('scrape-odds'), health, CacheTtl.JOB_HEALTH);
  }
}
