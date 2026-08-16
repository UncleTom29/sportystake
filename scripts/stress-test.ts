/**
 * High-Concurrency Production Stress & Load Testing Harness for SportyStake.
 *
 * Runs concurrent virtual users across critical endpoints:
 *  - Sportsbook market feeds (upcoming, live, sports, leagues, search)
 *  - Casino state (games, vault liquidity, crash round state, history)
 *  - Protocol solvency (liquidity pool stats, public feeds, leaderboards)
 *  - System health & detailed latency checks
 *
 * Usage:
 *   npx tsx scripts/stress-test.ts [--concurrency 50] [--requests 500] [--url http://localhost:3000]
 */

interface StressOptions {
  baseUrl: string;
  concurrency: number;
  totalRequests: number;
  scenarios: string[];
}

interface RequestMetric {
  endpoint: string;
  durationMs: number;
  status: number;
  ok: boolean;
  error?: string;
}

const ENDPOINTS = [
  { path: "/api/markets/upcoming", weight: 30, name: "Upcoming Markets" },
  { path: "/api/markets/live", weight: 20, name: "Live Markets" },
  { path: "/api/markets/sports", weight: 10, name: "Sports List" },
  { path: "/api/markets/leagues", weight: 10, name: "Leagues List" },
  { path: "/api/casino/games", weight: 10, name: "Casino Games" },
  { path: "/api/casino/vault", weight: 10, name: "Casino Vault" },
  { path: "/api/casino/crash/state", weight: 15, name: "Crash State" },
  { path: "/api/liquidity/pool", weight: 10, name: "Liquidity Pool" },
  { path: "/api/bets/public", weight: 5, name: "Public Bets Feed" },
  { path: "/api/health", weight: 5, name: "Health Check" },
];

function pickWeightedEndpoint(): (typeof ENDPOINTS)[number] {
  const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const ep of ENDPOINTS) {
    r -= ep.weight;
    if (r <= 0) return ep;
  }
  return ENDPOINTS[0];
}

function parseArgs(): StressOptions {
  const args = process.argv.slice(2);
  let baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  let concurrency = 50;
  let totalRequests = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) baseUrl = args[++i];
    if (args[i] === "--concurrency" && args[i + 1]) concurrency = parseInt(args[++i], 10);
    if (args[i] === "--requests" && args[i + 1]) totalRequests = parseInt(args[++i], 10);
  }

  return { baseUrl, concurrency, totalRequests, scenarios: ["all"] };
}

function calculatePercentiles(latencies: number[]): {
  min: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
} {
  if (latencies.length === 0) {
    return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    min: Math.round(sorted[0]),
    p50: Math.round(getP(0.5)),
    p90: Math.round(getP(0.9)),
    p95: Math.round(getP(0.95)),
    p99: Math.round(getP(0.99)),
    max: Math.round(sorted[sorted.length - 1]),
    avg: Math.round(sum / sorted.length),
  };
}

async function runSingleRequest(baseUrl: string, workerId: number): Promise<RequestMetric> {
  const ep = pickWeightedEndpoint();
  const url = `${baseUrl}${ep.path}`;
  const start = performance.now();
  const simulatedIp = `198.51.100.${(workerId % 250) + 1}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const durationMs = performance.now() - start;
    await res.text().catch(() => "");

    return {
      endpoint: ep.path,
      durationMs,
      status: res.status,
      ok: res.ok,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    return {
      endpoint: ep.path,
      durationMs,
      status: 0,
      ok: false,
      error: (err as Error).message,
    };
  }
}

async function runWorker(
  workerId: number,
  baseUrl: string,
  requestsPerWorker: number,
  onMetric: (m: RequestMetric) => void,
): Promise<void> {
  for (let i = 0; i < requestsPerWorker; i++) {
    const metric = await runSingleRequest(baseUrl, workerId);
    onMetric(metric);
  }
}

async function main() {
  const opts = parseArgs();

  console.log("\n============================================================");
  console.log(" 🚀 SPORTYSTAKE HIGH-CONCURRENCY LOAD & STRESS TEST");
  console.log("============================================================");
  console.log(` Target URL:          ${opts.baseUrl}`);
  console.log(` Concurrency Level:   ${opts.concurrency} parallel virtual users`);
  console.log(` Total Requests:      ${opts.totalRequests}`);
  console.log(" Endpoints Tested:    Markets, Live Odds, Casino, Solvency, Health");
  console.log("============================================================\n");

  const metrics: RequestMetric[] = [];
  const statusCounts: Record<number, number> = {};
  const endpointMetrics: Record<string, number[]> = {};

  const requestsPerWorker = Math.ceil(opts.totalRequests / opts.concurrency);
  const startTime = performance.now();

  let completed = 0;
  const progressInterval = setInterval(() => {
    const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
    const rps = (completed / Math.max(0.1, Number(elapsedSec))).toFixed(0);
    process.stdout.write(`\r [Progress] Completed: ${completed}/${opts.totalRequests} reqs (${rps} req/s, ${elapsedSec}s elapsed)`);
  }, 250);

  const workers = Array.from({ length: opts.concurrency }, (_, i) =>
    runWorker(i, opts.baseUrl, requestsPerWorker, (m) => {
      metrics.push(m);
      completed++;
      statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
      if (!endpointMetrics[m.endpoint]) endpointMetrics[m.endpoint] = [];
      endpointMetrics[m.endpoint].push(m.durationMs);
    }),
  );

  await Promise.all(workers);
  clearInterval(progressInterval);

  const totalDurationMs = performance.now() - startTime;
  const totalDurationSec = totalDurationMs / 1000;
  const overallRps = (metrics.length / totalDurationSec).toFixed(1);

  const latencies = metrics.map((m) => m.durationMs);
  const stats = calculatePercentiles(latencies);
  const successCount = metrics.filter((m) => m.ok).length;
  const failCount = metrics.length - successCount;
  const successRate = ((successCount / metrics.length) * 100).toFixed(2);

  console.log("\n\n============================================================");
  console.log(" 📊 STRESS TEST RESULTS SUMMARY");
  console.log("============================================================");
  console.log(` Total Completed:     ${metrics.length} requests in ${totalDurationSec.toFixed(2)}s`);
  console.log(` Throughput:          ${overallRps} requests/second`);
  console.log(` Success Rate:        ${successRate}% (${successCount} OK, ${failCount} Failed)`);
  console.log("------------------------------------------------------------");
  console.log(" ⏱ LATENCY PERCENTILES (Round-Trip Time):");
  console.log(`   Min:               ${stats.min} ms`);
  console.log(`   P50 (Median):      ${stats.p50} ms`);
  console.log(`   P90:               ${stats.p90} ms`);
  console.log(`   P95:               ${stats.p95} ms`);
  console.log(`   P99:               ${stats.p99} ms`);
  console.log(`   Max:               ${stats.max} ms`);
  console.log(`   Avg:               ${stats.avg} ms`);
  console.log("------------------------------------------------------------");
  console.log(" 📋 HTTP STATUS CODE DISTRIBUTION:");
  for (const [status, count] of Object.entries(statusCounts)) {
    const pct = ((count / metrics.length) * 100).toFixed(1);
    console.log(`   Status ${status.padStart(3)}:        ${count} (${pct}%)`);
  }
  console.log("------------------------------------------------------------");
  console.log(" 🎯 PER-ENDPOINT P95 LATENCY BREAKDOWN:");
  for (const [ep, lats] of Object.entries(endpointMetrics)) {
    const epStats = calculatePercentiles(lats);
    console.log(`   ${ep.padEnd(28)} | Req: ${lats.length.toString().padStart(4)} | P50: ${epStats.p50.toString().padStart(3)}ms | P95: ${epStats.p95.toString().padStart(3)}ms | Max: ${epStats.max.toString().padStart(4)}ms`);
  }
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("Stress test failed to run:", err);
  process.exit(1);
});
