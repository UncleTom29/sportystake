import 'dotenv/config';
import Redis from 'ioredis';
import express, { type Request, type Response } from 'express';
import cron from 'node-cron';
import { config } from './config.js';
import { logger } from './logger.js';
import { CacheManager } from './cache/cache-manager.js';
import { RedisPublisher } from './publishers/redis-publisher.js';
import { ScrapeOddsJob } from './jobs/scrape-odds.job.js';
import { XbetLiveJob } from './jobs/live-poller.job.js';
import { CacheKeys } from './cache/cache-keys.js';
import { metrics } from './metrics.js';

async function bootstrap(): Promise<void> {
  logger.info({ version: '0.3.0', env: config.NODE_ENV }, 'oracle:starting');

  // commandTimeout bounds every individual command — without it, a command
  // issued while Redis is mid-restart can sit in ioredis's offline queue
  // indefinitely (maxRetriesPerRequest: null means "retry forever", not
  // "give up after N ms"), which previously wedged a cron job's re-entrancy
  // lock permanently since its `finally` block never ran. See jobs' own
  // stale-lock fallback for the second layer of defense against that.
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, commandTimeout: 15_000 });
  const redisPub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, commandTimeout: 15_000 });
  try {
    await redis.connect();
    await redisPub.connect();
    logger.info('redis:connected');
  } catch (err) {
    logger.warn({ err }, 'redis:connect-failed — running without persistence');
  }

  const cache     = new CacheManager(redis, logger);
  const publisher = new RedisPublisher(redisPub, logger);

  const scrapeOddsJob = new ScrapeOddsJob(cache, publisher, logger);
  const liveJob       = new XbetLiveJob(cache, publisher, logger);

  // Seed on startup so the sync-worker has data before the first cron tick.
  logger.info('oracle:seeding — running initial scrape (may take ~90s)');
  await scrapeOddsJob.run();
  // Start live polling immediately too.
  void liveJob.run();

  // Scrape 1xbet prematch odds every 3 minutes — full snapshot + all market lines.
  cron.schedule('*/3 * * * *', () => void scrapeOddsJob.run());

  // Poll live scores every 2 minutes for settlement and score ticks.
  cron.schedule('*/2 * * * *', () => void liveJob.run());

  logger.info('cron:scheduled — scrape=*/3m  live=*/2m');

  // ─── HTTP surface ──────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());

  app.use('/internal', (req, res, next) => {
    const key = req.header('x-oracle-key');
    if (key !== config.ORACLE_INTERNAL_API_KEY) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.get('/status', async (_req: Request, res: Response) => {
    const [scrapeOdds, livePoller] = await Promise.all([
      cache.get(CacheKeys.jobHealth('scrape-odds')),
      cache.get(CacheKeys.jobHealth('live-poller')),
    ]);
    res.json({
      ok: true,
      version: '0.3.0',
      env: config.NODE_ENV,
      ts: new Date().toISOString(),
      jobs: { 'scrape-odds': scrapeOdds, 'live-poller': livePoller },
    });
  });

  app.get('/metrics', (_req: Request, res: Response) => {
    res.type('text/plain; version=0.0.4').send(metrics.render());
  });

  app.get('/internal/fixtures/live', async (_req: Request, res: Response) => {
    const fixtures = await cache.get(CacheKeys.fixturesLive());
    res.json({ fixtures: fixtures ?? [] });
  });

  app.get('/internal/fixtures/by-date/:date', async (req: Request, res: Response) => {
    const fixtures = await cache.get(CacheKeys.fixturesByDate(req.params.date));
    res.json({ date: req.params.date, fixtures: fixtures ?? [] });
  });

  app.get('/internal/odds/:fixtureId', async (req: Request, res: Response) => {
    const fixtureId = Number(req.params.fixtureId);
    const live      = await cache.get(CacheKeys.oddsLive(fixtureId));
    const prematch  = await cache.get(CacheKeys.oddsPrematch(fixtureId));
    res.json({ fixtureId, live, prematch });
  });

  app.post('/internal/jobs/run/:job', async (req: Request, res: Response) => {
    const job = req.params.job;
    try {
      switch (job) {
        case 'scrape-odds': await scrapeOddsJob.run(); break;
        case 'live-poller': await liveJob.run();       break;
        default:
          res.status(404).json({ error: `unknown job: ${job}` });
          return;
      }
      res.json({ ok: true, job });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const server = app.listen(config.ORACLE_PORT, () => {
    logger.info({ port: config.ORACLE_PORT }, 'oracle:listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'oracle:shutting-down');
    server.close();
    try { await redis.quit(); } catch { /* ignore */ }
    try { await redisPub.quit(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.once('SIGINT',  (sig) => void shutdown(sig));
  process.once('SIGTERM', (sig) => void shutdown(sig));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'oracle:fatal');
  process.exit(1);
});
