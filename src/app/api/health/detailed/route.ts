import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { redis } from "@/lib/server/redis";
import { prisma } from "@/lib/server/db";
import { serverEnv, clientEnv } from "@/lib/env";

export const runtime = "nodejs";

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

async function checkPostgres(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, detail: (err as Error).message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const r = redis();
    const pong = await r.ping();
    return { ok: pong === "PONG", latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, detail: (err as Error).message };
  }
}

interface JobHealth {
  ts: string;
  ok: boolean;
  rows: number;
  error: string | null;
}

async function checkOracle(): Promise<CheckResult & { quota?: unknown; jobs?: Record<string, JobHealth | null> }> {
  const t0 = Date.now();
  try {
    const url = `${serverEnv.ORACLE_INTERNAL_API_URL.replace(/\/$/, "")}/status`;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 2_500);
    const res = await fetch(url, {
      headers: { "x-oracle-key": serverEnv.ORACLE_INTERNAL_API_KEY },
      signal: ctl.signal,
    }).finally(() => clearTimeout(to));
    if (!res.ok) return { ok: false, latencyMs: Date.now() - t0, detail: `HTTP ${res.status}` };
    const json = await res.json() as { quota?: unknown; jobs?: Record<string, JobHealth | null> };
    return { ok: true, latencyMs: Date.now() - t0, quota: json.quota, jobs: json.jobs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, detail: (err as Error).message };
  }
}

/** Scraper job cadences, in ms — used to judge staleness with margin for one
 *  missed tick plus the ~140s startup seed-scrape window. */
const JOB_CADENCE_MS: Record<string, number> = {
  "scrape-odds": 3 * 60_000,
  "live-poller": 2 * 60_000,
};
const STALE_MULTIPLIER = 3;

function evaluateJob(name: string, health: JobHealth | null | undefined): CheckResult {
  if (!health) return { ok: false, detail: `${name}: no health record yet` };
  const ageMs = Date.now() - new Date(health.ts).getTime();
  const maxAgeMs = (JOB_CADENCE_MS[name] ?? 3 * 60_000) * STALE_MULTIPLIER;
  if (ageMs > maxAgeMs) {
    return { ok: false, detail: `${name}: stale — last run ${Math.round(ageMs / 1000)}s ago` };
  }
  if (!health.ok) {
    return { ok: false, detail: `${name}: ${health.error ?? "last run failed"}` };
  }
  return { ok: true, detail: `${name}: ${health.rows} rows` };
}

function checkContracts(): CheckResult {
  const zero = "0x0000000000000000000000000000000000000000";
  const addrs = {
    bettingCore: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS,
    liquidityPool: clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS,
    casinoHouse: clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS,
    crashGame: clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS,
    usdc: clientEnv.NEXT_PUBLIC_USDC_ADDRESS,
  };
  const missing = Object.entries(addrs).filter(([, v]) => v === zero).map(([k]) => k);
  return missing.length === 0
    ? { ok: true }
    : { ok: false, detail: `missing addresses: ${missing.join(", ")}` };
}

/**
 * /api/health/detailed — used by k8s readiness probes + the admin dashboard.
 * Returns 200 only when every infra check passes; 503 otherwise so the
 * orchestrator can take this pod out of rotation.
 *
 * Scraper job health is reported separately (`checks.scraper`) and factors
 * into `status` but NOT the HTTP status code: a stale odds feed means the
 * sportsbook shows old prices, not that auth/casino/wallet are broken, so it
 * shouldn't pull the whole pod out of rotation. Point an uptime monitor at
 * `checks.scraper.ok` in the JSON body if you want a dedicated alert on it.
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  const [postgres, redisCheck, oracle] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkOracle(),
  ]);
  const contracts = checkContracts();
  const infraOk = postgres.ok && redisCheck.ok && oracle.ok && contracts.ok;

  const scrapeOdds = evaluateJob("scrape-odds", oracle.jobs?.["scrape-odds"]);
  const livePoller = evaluateJob("live-poller", oracle.jobs?.["live-poller"]);
  const scraper = { ok: scrapeOdds.ok && livePoller.ok, scrapeOdds, livePoller };

  const status = !infraOk ? "down" : !scraper.ok ? "degraded" : "ok";

  return ok(
    {
      status,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
      env: serverEnv.NODE_ENV,
      checks: { postgres, redis: redisCheck, oracle, contracts, scraper },
    },
    { status: infraOk ? 200 : 503 },
  );
});
