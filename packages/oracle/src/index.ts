import 'dotenv/config';
import Redis from 'ioredis';
import express, { type Request, type Response } from 'express';
import cron from 'node-cron';
import { config } from './config.js';
import { logger } from './logger.js';
import { CacheManager } from './cache/cache-manager.js';
import { QuotaTracker } from './quota/quota-tracker.js';
import { QuotaBudgetManager } from './quota/quota-budget-manager.js';
import { MockApiFootballClient } from './providers/mock.client.js';
import type { IFootballProvider } from './providers/provider.interface.js';
import { RedisPublisher } from './publishers/redis-publisher.js';
import { DailyFixturesJob } from './jobs/daily-fixtures.job.js';
import { LivePollerJob } from './jobs/live-poller.job.js';
import { OddsRefresherJob } from './jobs/odds-refresher.job.js';
import { StandingsJob } from './jobs/standings.job.js';
import { CacheKeys } from './cache/cache-keys.js';

async function bootstrap(): Promise<void> {
  logger.info(
    { version: '0.1.0', env: config.NODE_ENV, useMock: config.USE_MOCK_PROVIDER },
    'oracle:starting',
  );

  // Two Redis connections: one for general I/O, one dedicated to publishing.
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  const redisPub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  try {
    await redis.connect();
    await redisPub.connect();
    logger.info('redis:connected');
  } catch (err) {
    logger.warn({ err }, 'redis:connect-failed — running without persistence');
  }

  const cache = new CacheManager(redis, logger);
  const quotaTracker = new QuotaTracker(redis, logger);
  const quotaManager = new QuotaBudgetManager(redis, logger, quotaTracker);
  await quotaManager.init();

  const provider: IFootballProvider = config.USE_MOCK_PROVIDER
    ? new MockApiFootballClient()
    : new MockApiFootballClient();

  const publisher = new RedisPublisher(redisPub, logger);

  const dailyJob = new DailyFixturesJob(provider, cache, publisher, quotaManager, logger);
  const livePoller = new LivePollerJob(provider, cache, publisher, quotaManager, logger);
  const oddsRefresher = new OddsRefresherJob(provider, cache, publisher, quotaManager, logger);
  const standingsJob = new StandingsJob(provider, cache, quotaManager, logger);

  // Seed cache on startup so the API has data immediately.
  await dailyJob.run();

  cron.schedule('0 1 * * *', () => void dailyJob.run(), { timezone: 'UTC' });
  cron.schedule('*/45 * * * * *', () => void livePoller.run());
  cron.schedule('*/30 * * * *', () => void oddsRefresher.run());
  cron.schedule('0 */6 * * *', () => void standingsJob.run(), { timezone: 'UTC' });

  logger.info('cron:scheduled');

  // ─── HTTP surface ──────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());

  // Simple auth middleware for /internal routes.
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
    try {
      const providerStatus = await provider.getStatus();
      const quotaStatus = quotaManager.getStatus();
      res.json({ provider: providerStatus, quota: quotaStatus });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
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
    const live = await cache.get(CacheKeys.oddsLive(fixtureId));
    const prematch = await cache.get(
      CacheKeys.oddsPrematch(fixtureId, config.API_FOOTBALL_BOOKMAKER_ID),
    );
    res.json({ fixtureId, live, prematch });
  });

  app.post('/internal/jobs/run/:job', async (req: Request, res: Response) => {
    const job = req.params.job;
    try {
      switch (job) {
        case 'daily-fixtures':
          await dailyJob.run();
          break;
        case 'live-poller':
          await livePoller.run();
          break;
        case 'odds-refresher':
          await oddsRefresher.run();
          break;
        case 'standings':
          await standingsJob.run();
          break;
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

  // ─── graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'oracle:shutting-down');
    server.close();
    quotaManager.stop();
    try { await redis.quit(); } catch { /* ignore */ }
    try { await redisPub.quit(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.once('SIGINT', (sig) => void shutdown(sig));
  process.once('SIGTERM', (sig) => void shutdown(sig));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'oracle:fatal');
  process.exit(1);
});
