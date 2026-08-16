/**
 * Prometheus-format metrics for the oracle. Exposed at GET /metrics.
 *
 * Counters update in-place via the exported `metrics` object. Jobs +
 * provider clients should call the corresponding `metrics.*` helpers
 * when they record activity.
 */

type Counter = { value: number };
type Gauge = { value: number };

interface Registry {
  apiRequests: Map<string, Counter>;     // labels: endpoint, status
  apiErrors: Map<string, Counter>;       // labels: endpoint, code
  cacheHits: Map<string, Counter>;       // labels: cache_key_kind
  jobRuns: Map<string, Counter>;         // labels: job, outcome (ok/error)
  jobDurationMs: Map<string, Counter>;   // running sum + count for avg
  quotaRemaining: Gauge;
  quotaMode: Gauge;                      // 0=normal, 1=conservation, 2=emergency
}

const registry: Registry = {
  apiRequests: new Map(),
  apiErrors: new Map(),
  cacheHits: new Map(),
  jobRuns: new Map(),
  jobDurationMs: new Map(),
  quotaRemaining: { value: 100 },
  quotaMode: { value: 0 },
};

function bump(map: Map<string, Counter>, key: string, by = 1): void {
  const e = map.get(key);
  if (e) e.value += by;
  else map.set(key, { value: by });
}

function renderCounters(name: string, map: Map<string, Counter>, help: string): string {
  if (map.size === 0) return "";
  let s = `# HELP ${name} ${help}\n# TYPE ${name} counter\n`;
  for (const [labels, c] of map) {
    s += `${name}${labels} ${c.value}\n`;
  }
  return s;
}

function renderGauge(name: string, g: Gauge, help: string): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name} ${g.value}\n`;
}

export const metrics = {
  recordApiRequest(endpoint: string, status: number): void {
    bump(registry.apiRequests, `{endpoint="${endpoint}",status="${status}"}`);
  },
  recordApiError(endpoint: string, code: string): void {
    bump(registry.apiErrors, `{endpoint="${endpoint}",code="${code}"}`);
  },
  recordCacheHit(kind: string, hit: boolean): void {
    bump(registry.cacheHits, `{kind="${kind}",hit="${hit}"}`);
  },
  recordJobRun(job: string, outcome: "ok" | "error", durationMs: number): void {
    bump(registry.jobRuns, `{job="${job}",outcome="${outcome}"}`);
    bump(registry.jobDurationMs, `{job="${job}"}`, Math.round(durationMs));
  },
  setQuotaRemaining(n: number): void { registry.quotaRemaining.value = n; },
  setQuotaMode(mode: "normal" | "conservation" | "emergency"): void {
    registry.quotaMode.value = mode === "emergency" ? 2 : mode === "conservation" ? 1 : 0;
  },

  /** Render the registry as a Prometheus text-format payload. */
  render(): string {
    return [
      renderCounters("oracle_api_requests_total", registry.apiRequests, "API-Football requests"),
      renderCounters("oracle_api_errors_total", registry.apiErrors, "API-Football errors"),
      renderCounters("oracle_cache_total", registry.cacheHits, "Cache hits/misses"),
      renderCounters("oracle_job_runs_total", registry.jobRuns, "Scheduled job runs"),
      renderCounters("oracle_job_duration_ms_total", registry.jobDurationMs, "Job total duration (sum)"),
      renderGauge("oracle_quota_remaining", registry.quotaRemaining, "API-Football quota remaining today"),
      renderGauge("oracle_quota_mode", registry.quotaMode, "Quota mode: 0=normal,1=conservation,2=emergency"),
    ].join("\n");
  },
};
