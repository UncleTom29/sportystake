"use client";
import { useState, useEffect } from "react";
import { ZapIcon, ShieldIcon, TrendUp, TrendDown, SparkleIcon, BadgeCheck } from "@/components/icons/UIIcons";

type QuotaMode = "normal" | "conservation" | "emergency";

const MOCK_QUOTA = { used: 34, remaining: 66, resetIn: "06:12:44", mode: "normal" as QuotaMode };

const MOCK_RISKS = [
  { marketId: "m1", match: "Arsenal vs Man City", utilization: 0.87, poolTvl: 4280, maxLiability: 8200, coverage: 0.52, risk: "critical" as const },
  { marketId: "m2", match: "Chelsea vs Liverpool", utilization: 0.72, poolTvl: 3140, maxLiability: 5100, coverage: 0.61, risk: "warning" as const },
  { marketId: "m3", match: "Bayern vs Dortmund", utilization: 0.44, poolTvl: 6200, maxLiability: 4100, coverage: 1.51, risk: "safe" as const },
  { marketId: "m4", match: "Real Madrid vs Barça", utilization: 0.91, poolTvl: 8400, maxLiability: 18200, coverage: 0.46, risk: "critical" as const },
];

const MOCK_OVERVIEW = {
  ggrToday: 1248, ggrWeek: 8420, ggrMonth: 34200,
  activeUsers24h: 284, betCount: 1842, volume: 48200,
  lpTvl: 124000,
};

const QUOTA_BREAKDOWN = [
  { label: "Live fixtures", used: 12, color: "var(--color-live)" },
  { label: "Pre-match odds", used: 8, color: "var(--color-brand-500)" },
  { label: "Daily fixtures", used: 4, color: "var(--color-info)" },
  { label: "Standings", used: 6, color: "#a78bfa" },
  { label: "H2H / other", used: 4, color: "var(--color-warn)" },
];

const QUOTA_MODE_STYLE: Record<QuotaMode, { label: string; color: string; bg: string }> = {
  normal:       { label: "NORMAL",       color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.1)" },
  conservation: { label: "CONSERVATION", color: "var(--color-warn)",      bg: "rgba(255,176,32,0.1)" },
  emergency:    { label: "EMERGENCY",    color: "var(--color-live)",      bg: "rgba(255,45,45,0.1)" },
};

export default function AdminAnalyticsPage() {
  const [quota, setQuota] = useState(MOCK_QUOTA);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const quotaModeStyle = QUOTA_MODE_STYLE[quota.mode];
  const quotaPercent = (quota.used / 100) * 100;
  const quotaBarColor = quota.used > 85 ? "var(--color-live)" : quota.used > 70 ? "var(--color-warn)" : "var(--color-brand-500)";

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Admin Analytics</h1>
          <p className="text-[12px] text-[var(--color-ink-3)]">Restricted · Admin access required</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--color-bg-2)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-brand-500)]">
          <BadgeCheck className="h-3.5 w-3.5" />
          ADMIN
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Platform overview */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <OverviewCard label="GGR today" value={`$${MOCK_OVERVIEW.ggrToday.toLocaleString()}`} sub="gross gaming revenue" accent="var(--color-brand-500)" Icon={TrendUp} />
            <OverviewCard label="GGR this week" value={`$${MOCK_OVERVIEW.ggrWeek.toLocaleString()}`} sub={`$${MOCK_OVERVIEW.ggrMonth.toLocaleString()} this month`} accent="var(--color-brand-500)" Icon={TrendUp} />
            <OverviewCard label="Active users (24h)" value={String(MOCK_OVERVIEW.activeUsers24h)} sub={`${MOCK_OVERVIEW.betCount} bets placed`} accent="var(--color-info)" Icon={ZapIcon} />
            <OverviewCard label="LP TVL" value={`$${(MOCK_OVERVIEW.lpTvl / 1000).toFixed(0)}K`} sub={`$${(MOCK_OVERVIEW.volume / 1000).toFixed(0)}K bet volume`} accent="#a78bfa" Icon={SparkleIcon} />
          </div>

          {/* Risk panel */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-[var(--color-live)]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Risk exposure</p>
              </div>
              <span className="text-[11px] text-[var(--color-ink-3)]">
                {MOCK_RISKS.filter((r) => r.risk === "critical").length} critical · {MOCK_RISKS.filter((r) => r.risk === "warning").length} warning
              </span>
            </div>
            <div className="grid grid-cols-[1fr_80px_80px_80px_70px] items-center border-b border-[var(--color-line-1)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
              <span>Market</span>
              <span className="text-center">Util %</span>
              <span className="text-center">Pool TVL</span>
              <span className="text-center">Max liability</span>
              <span className="text-center">Risk</span>
            </div>
            {MOCK_RISKS.map((r) => {
              const riskColor = r.risk === "critical" ? "var(--color-live)" : r.risk === "warning" ? "var(--color-warn)" : "var(--color-brand-500)";
              return (
                <div key={r.marketId} className="grid grid-cols-[1fr_80px_80px_80px_70px] items-center border-b border-[var(--color-line-1)] px-4 py-3 text-[12px] last:border-0">
                  <span className="font-semibold text-white">{r.match}</span>
                  <div className="px-2 text-center">
                    <span className="mono font-bold" style={{ color: riskColor }}>{(r.utilization * 100).toFixed(0)}%</span>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                      <div className="h-full rounded-full" style={{ width: `${r.utilization * 100}%`, background: riskColor }} />
                    </div>
                  </div>
                  <span className="mono text-center text-[var(--color-ink-2)]">${r.poolTvl.toLocaleString()}</span>
                  <span className="mono text-center text-[var(--color-ink-2)]">${r.maxLiability.toLocaleString()}</span>
                  <span className="text-center">
                    <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${riskColor}15`, color: riskColor }}>
                      {r.risk}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Settlement queue */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Pending settlements</p>
            <div className="space-y-2 text-[13px]">
              {[
                { match: "Arsenal vs Man City", time: "Starting in 12m", bets: 47, volume: "$4,200" },
                { match: "Crash Round #2841", time: "Active", bets: 12, volume: "$1,840" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{s.match}</p>
                    <p className="text-[11px] text-[var(--color-ink-3)]">{s.bets} bets · {s.volume}</p>
                  </div>
                  <span className="mono text-[11px] text-[var(--color-warn)]">{s.time}</span>
                  <button className="rounded-md bg-[var(--color-brand-500)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-bg-0)]">
                    Settle
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quota panel */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">API-Football quota</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">Resets in {quota.resetIn} (00:00 UTC)</p>
              </div>
              <span className="mono rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: quotaModeStyle.bg, color: quotaModeStyle.color }}>
                {quotaModeStyle.label}
              </span>
            </div>

            {/* Big gauge */}
            <div className="mb-4 text-center">
              <p className="mono text-5xl font-black" style={{ color: quotaBarColor }}>{quota.used}</p>
              <p className="text-[13px] text-[var(--color-ink-3)]">of 100 requests used today</p>
            </div>
            <div className="mb-3 h-3 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${quotaPercent}%`, background: quotaBarColor }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[var(--color-ink-3)]">
              <span>{quota.remaining} remaining</span>
              <span>{quotaPercent.toFixed(0)}% used</span>
            </div>

            {/* Breakdown */}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Requests by type</p>
              {QUOTA_BREAKDOWN.map((q) => (
                <div key={q.label} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: q.color }} />
                  <span className="flex-1 text-[var(--color-ink-2)]">{q.label}</span>
                  <span className="mono font-bold text-white">{q.used}</span>
                  <div className="w-20 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                    <div className="h-full rounded-full" style={{ width: `${(q.used / 34) * 100}%`, background: q.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md bg-[var(--color-bg-1)] p-3 text-[11px] text-[var(--color-ink-3)] leading-relaxed">
              <strong className="text-white">Mode rules:</strong><br />
              Normal (≥15 remaining): all calls allowed<br />
              Conservation (5–14): high/critical only<br />
              Emergency (&lt;5): live scores only; UI shows "data delayed"
            </div>
          </div>

          {/* Oracle controls */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Oracle controls</p>
            <OracleRow label="Daily fixtures job" status="running" lastRun="06:00 UTC" />
            <OracleRow label="Live poller" status="running" lastRun="1m ago" />
            <OracleRow label="Odds refresher" status="idle" lastRun="14m ago" />
            <OracleRow label="Standings job" status="idle" lastRun="03:00 UTC" />
          </div>

          {/* Health */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">System health</p>
            {[
              { label: "API server", ok: true },
              { label: "Oracle service", ok: true },
              { label: "Redis cache", ok: true },
              { label: "Arc RPC", ok: true },
              { label: "API-Football", ok: quota.remaining > 5 },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-ink-2)]">{s.label}</span>
                <span className="flex items-center gap-1.5 font-bold" style={{ color: s.ok ? "var(--color-brand-500)" : "var(--color-live)" }}>
                  <span className={`h-2 w-2 rounded-full ${s.ok ? "bg-[var(--color-brand-500)]" : "bg-[var(--color-live)] animate-pulse"}`} />
                  {s.ok ? "OK" : "DEGRADED"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, sub, accent, Icon }: {
  label: string; value: string; sub: string; accent: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${accent}20`, color: accent }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mono text-xl font-black" style={{ color: accent }}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}

function OracleRow({ label, status, lastRun }: { label: string; status: "running" | "idle" | "error"; lastRun: string }) {
  const color = status === "running" ? "var(--color-brand-500)" : status === "error" ? "var(--color-live)" : "var(--color-ink-3)";
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--color-ink-2)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--color-ink-3)]">{lastRun}</span>
        <span className="mono flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}15`, color }}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "animate-pulse" : ""}`} style={{ background: color }} />
          {status}
        </span>
      </div>
    </div>
  );
}
