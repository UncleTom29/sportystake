"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Admin, Health, type AdminAnalyticsOverview } from "@/lib/api-client";
import { useWallet } from "@/lib/walletStore";
import { useNotifications } from "@/lib/notificationStore";
import type { MarketDTO, UserDTO, UserStats, QuotaStatus } from "@/lib/types";
import {
  ShieldIcon,
  ZapIcon,
  BadgeCheck,
  ChevronRight,
  CloseIcon,
  TrophyIcon,
  StarIcon,
} from "@/components/icons/UIIcons";
import OnChainVaultManager from "@/components/admin/OnChainVaultManager";

type Tab = "analytics" | "risk" | "markets" | "users";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "analytics", label: "Analytics & Quota", icon: "📊" },
  { id: "risk", label: "Vaults & Liquidity", icon: "🛡️" },
  { id: "markets", label: "Markets & Settlement", icon: "⚽" },
  { id: "users", label: "User Governance", icon: "👥" },
];

export default function AdminPortalPage() {
  const { address, authStatus } = useWallet();
  const pushToast = useNotifications((s) => s.pushToast);
  const [tab, setTab] = useState<Tab>("analytics");
  const [me, setMe] = useState<{ roles: string[]; username?: string } | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Check admin authorization
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.data?.user) {
          setMe(data.data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const isAdminWallet =
    address?.toLowerCase() === "0x518923383f1184bfeb990b640d75dabb224e7f5b".toLowerCase() ||
    address?.toLowerCase() === "0xaa789e29a8ed011b57d7c3fe8a878d217ebebc22".toLowerCase() ||
    address?.toLowerCase() === "0x99b5208466bb6b359f4f4f4e735e5d3fa9612f37".toLowerCase();
  const isAdmin = me?.roles?.includes("ADMIN") || isAdminWallet;
  const isOperator = me?.roles?.includes("OPERATOR") || isAdminWallet;
  const isAuthorized = isAdmin || isOperator;

  if (loadingMe) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent" />
        <p className="text-[12px] text-[var(--color-ink-3)]">Verifying admin credentials…</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-live)]/10 text-[var(--color-live)] ring-1 ring-[var(--color-live)]/30">
          <ShieldIcon className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Access Denied</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
          The Admin Portal requires <strong className="text-white">ADMIN</strong> or{" "}
          <strong className="text-white">OPERATOR</strong> privileges. Your wallet address (
          <code className="mono text-[11px] text-[var(--color-brand-500)]">
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}
          </code>
          ) is not authorized.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/sportsbook"
            className="rounded-lg bg-[var(--color-bg-2)] px-4 py-2 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)]"
          >
            ← Back to Sportsbook
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-5 md:px-5">
      {/* Top Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Admin Portal</h1>
              <span className="mono rounded-full bg-[var(--color-brand-500)]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                {isAdmin ? "ADMIN" : "OPERATOR"}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">
              Protocol Governance · Market Settlement · Risk Controls · User Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px]">
          <span className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-1)] px-3 py-1.5 font-semibold text-[var(--color-brand-500)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
            System Live
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1.5 scrollbar-none">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-[12px] font-bold transition-all ${
                active
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-lg"
                  : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {tab === "analytics" && <AnalyticsSection />}
        {tab === "risk" && <RiskSection />}
        {tab === "markets" && <MarketsSection />}
        {tab === "users" && <UsersSection isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Utility Helper: Format USDC to 2 decimal places
   ─────────────────────────────────────────────────────────────────────────── */
function formatUsdcNum(val?: string | number): string {
  const n = typeof val === "number" ? val : parseFloat(String(val ?? "0"));
  return `$${(isNaN(n) ? 0 : n).toFixed(2)} USDC`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. Analytics & Quota Module
   ─────────────────────────────────────────────────────────────────────────── */
function AnalyticsSection() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      Admin.overview().then(setOverview).catch(() => {}),
      Admin.quota().then(setQuota).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-bg-2)]" />;
  }

  return (
    <div className="space-y-6">
      {/* Real Overview Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="24h Volume" value={formatUsdcNum(overview?.volume?.today)} accent="var(--color-brand-500)" />
        <MetricCard label="24h GGR" value={formatUsdcNum(overview?.ggr?.today)} accent="var(--color-brand-500)" />
        <MetricCard label="Active Bettors (24h)" value={String(overview?.activeUsersToday ?? 0)} />
        <MetricCard label="Shared Pool TVL" value={formatUsdcNum(overview?.lpTvl)} accent="var(--color-info)" />
        <MetricCard label="7-Day Volume" value={formatUsdcNum(overview?.volume?.week)} />
        <MetricCard label="7-Day GGR" value={formatUsdcNum(overview?.ggr?.week)} />
        <MetricCard label="30-Day Volume" value={formatUsdcNum(overview?.volume?.month)} />
        <MetricCard label="Total Bets Placed" value={String(overview?.bets ?? 0)} />
      </div>

      {/* Sports Data Feed & Oracle Sync Status Meter */}
      <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Sports Data Feed & Oracle Sync Status</h3>
            <p className="text-[11px] text-[var(--color-ink-3)]">Live internal oracle sync & request quota rate</p>
          </div>
          <span className="mono rounded bg-[var(--color-brand-500)]/10 px-2 py-1 text-[11px] font-bold text-[var(--color-brand-500)]">
            Mode: {quota?.mode?.toUpperCase() ?? "NORMAL"}
          </span>
        </div>

        {(() => {
          const used = quota?.used ?? 0;
          const remaining = quota?.remaining ?? 100;
          const total = used + remaining || 1;
          const percent = Math.min(100, Math.round((used / total) * 100));
          return (
            <>
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--color-bg-0)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-500)] transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-[var(--color-ink-3)]">
                <span>Used: {used} reqs ({percent}%)</span>
                <span>Remaining: {remaining} reqs</span>
                <span>Resets at: {quota?.resetAt ? new Date(quota.resetAt).toLocaleTimeString() : "00:00 UTC"}</span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function MetricCard({ label, value, trend, accent }: { label: string; value: string; trend?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="mono text-xl font-black" style={{ color: accent ?? "white" }}>
          {value}
        </span>
        {trend && <span className="mono text-[11px] font-bold text-[var(--color-brand-500)]">{trend}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. Risk & Liquidity Module
   ─────────────────────────────────────────────────────────────────────────── */
function VirtualLiquidityControl() {
  const [sportsVirt, setSportsVirt] = useState<string>("50000");
  const [casinoVirt, setCasinoVirt] = useState<string>("25000");
  const [wageredVirt, setWageredVirt] = useState<string>("5000000");
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/virtual-liquidity")
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.config) {
          setSportsVirt(String(json.data.config.sportsPoolUsdc ?? 50000));
          setCasinoVirt(String(json.data.config.casinoVaultUsdc ?? 25000));
          setWageredVirt(String(json.data.config.virtualWageredUsdc ?? 5000000));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/virtual-liquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportsPoolUsdc: parseFloat(sportsVirt) || 0,
          casinoVaultUsdc: parseFloat(casinoVirt) || 0,
          virtualWageredUsdc: parseFloat(wageredVirt) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg("Virtual stats & liquidity updated successfully!");
      } else {
        setMsg(data.message || "Failed to update virtual stats");
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-5 shadow-lg">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-brand-500)]" />
          Virtual Stats & Liquidity Configuration (Admin Control)
        </h3>
        <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
          Configure admin-injected virtual liquidity and wagered volume added to platform stats to boost capacity and displayed metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mb-1">
            Sports Betting Pool Virtual Liquidity (USDC)
          </label>
          <input
            type="number"
            value={sportsVirt}
            onChange={(e) => setSportsVirt(e.target.value)}
            className="mono w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
            placeholder="50000"
          />
          <p className="text-[10px] text-[var(--color-ink-4)] mt-1">
            Protocol capacity credit for sports betting markets
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mb-1">
            Casino House Vault Virtual Liquidity (USDC)
          </label>
          <input
            type="number"
            value={casinoVirt}
            onChange={(e) => setCasinoVirt(e.target.value)}
            className="mono w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
            placeholder="25000"
          />
          <p className="text-[10px] text-[var(--color-ink-4)] mt-1">
            Protocol capacity credit for casino house games
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mb-1">
            Total Wagered Volume Virtual Boost (USDC)
          </label>
          <input
            type="number"
            value={wageredVirt}
            onChange={(e) => setWageredVirt(e.target.value)}
            className="mono w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
            placeholder="5000000"
          />
          <p className="text-[10px] text-[var(--color-ink-4)] mt-1">
            Added to Total Wagered stat on homepage
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {msg && <span className="text-xs font-semibold text-[var(--color-brand-500)]">{msg}</span>}
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="ml-auto rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-xs font-bold text-black hover:bg-[var(--color-brand-400)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Virtual Liquidity"}
        </button>
      </div>
    </div>
  );
}

function RiskSection() {
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Admin.riskExposure()
      .then(setRisk)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* On-Chain Protocol Vaults & Direct Bankroll Funding */}
      <OnChainVaultManager />

      {/* Virtual Liquidity Admin Control */}
      <VirtualLiquidityControl />

      {/* Market Liabilities */}
      <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Market Exposure & Coverage Ratios</h3>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-[var(--color-bg-1)]" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[var(--color-line-1)] text-[10px] uppercase text-[var(--color-ink-3)]">
                <tr>
                  <th className="py-2">Market</th>
                  <th>Closes At</th>
                  <th>Bet Volume</th>
                  <th>Max Liability</th>
                  <th>Coverage</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-1)]">
                {risk?.items?.map((item: any) => (
                  <tr key={item.marketId} className="hover:bg-[var(--color-bg-1)]">
                    <td className="py-2.5 font-bold text-white">{item.label}</td>
                    <td className="text-[var(--color-ink-3)]">{new Date(item.closesAt).toLocaleString()}</td>
                    <td className="mono font-semibold">{formatUsdcNum(item.totalBetAmount)}</td>
                    <td className="mono font-semibold text-[var(--color-warn)]">{formatUsdcNum(item.maxLiability)}</td>
                    <td className="mono font-bold">{(item.coverageRatio * 100).toFixed(2)}%</td>
                    <td>
                      <span
                        className={`mono rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.riskLevel === "critical"
                            ? "bg-[var(--color-live)]/20 text-[var(--color-live)]"
                            : item.riskLevel === "warning"
                            ? "bg-[var(--color-warn)]/20 text-[var(--color-warn)]"
                            : "bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]"
                        }`}
                      >
                        {item.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. Market Management & Settlement Module
   ─────────────────────────────────────────────────────────────────────────── */
function MarketsSection() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [settleModal, setSettleModal] = useState<MarketDTO | null>(null);
  const pushToast = useNotifications((s) => s.pushToast);

  const fetchMarkets = useCallback(() => {
    setLoading(true);
    Admin.listMarkets({ status: statusFilter === "ALL" ? undefined : statusFilter, q: search })
      .then((res) => setMarkets(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const handleSuspend = async (id: string) => {
    try {
      await Admin.suspendMarket(id);
      pushToast({ kind: "success", title: "Market suspended" });
      fetchMarkets();
    } catch (e) {
      pushToast({ kind: "error", title: "Suspend failed", body: (e as Error).message });
    }
  };

  const handleResume = async (id: string) => {
    try {
      await Admin.resumeMarket(id);
      pushToast({ kind: "success", title: "Market resumed" });
      fetchMarkets();
    } catch (e) {
      pushToast({ kind: "error", title: "Resume failed", body: (e as Error).message });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await Admin.cancelMarket(id);
      pushToast({ kind: "success", title: "Market cancelled & voided" });
      fetchMarkets();
    } catch (e) {
      pushToast({ kind: "error", title: "Cancel failed", body: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, league, or market ID…"
          className="mono flex-1 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-3 py-2 text-[12px] font-semibold text-white outline-none placeholder:text-[var(--color-ink-4)] focus:border-[var(--color-brand-500)]"
        />
        <div className="flex gap-1 overflow-x-auto">
          {["ALL", "OPEN", "LIVE", "SUSPENDED", "SETTLED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${
                statusFilter === s
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                  : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Markets List */}
      <div className="space-y-2">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-[var(--color-bg-2)]" />
        ) : markets.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--color-ink-3)]">No markets match search filters</div>
        ) : (
          markets.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-[var(--color-ink-3)]">{m.id.slice(0, 10)}…</span>
                  <span className="mono rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {m.status}
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-3)]">{m.leagueName}</span>
                </div>
                <p className="font-bold text-white mt-0.5">
                  {m.homeTeam} vs {m.awayTeam}
                </p>
                <p className="text-[11px] text-[var(--color-ink-4)]">
                  Closes: {new Date(m.closesAt).toLocaleString()} · {m.betsCount ?? 0} bets placed
                </p>
              </div>

              <div className="flex items-center gap-2">
                {m.status === "OPEN" && (
                  <button
                    onClick={() => handleSuspend(m.id)}
                    className="rounded bg-[var(--color-warn)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-warn)] hover:bg-[var(--color-warn)]/20"
                  >
                    Suspend
                  </button>
                )}
                {m.status === "SUSPENDED" && (
                  <button
                    onClick={() => handleResume(m.id)}
                    className="rounded bg-[var(--color-brand-500)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/20"
                  >
                    Resume
                  </button>
                )}
                {(m.status === "OPEN" || m.status === "SUSPENDED" || m.status === "LIVE") && (
                  <>
                    <button
                      onClick={() => setSettleModal(m)}
                      className="rounded bg-[var(--color-brand-500)] px-3 py-1 text-[11px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
                    >
                      Settle Market
                    </button>
                    <button
                      onClick={() => handleCancel(m.id)}
                      className="rounded bg-[var(--color-live)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-live)] hover:bg-[var(--color-live)]/20"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Settle Modal */}
      {settleModal && (
        <SettleMarketModal market={settleModal} onClose={() => setSettleModal(null)} onSettled={fetchMarkets} />
      )}
    </div>
  );
}

function SettleMarketModal({
  market,
  onClose,
  onSettled,
}: {
  market: MarketDTO;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useNotifications((s) => s.pushToast);

  const handleSettle = async () => {
    setSubmitting(true);
    try {
      const res = await Admin.settleMarket(market.id, { homeScore, awayScore });
      pushToast({
        kind: "success",
        title: "Market Settled",
        body: `${res.won} bets won, ${res.voided} voided`,
      });
      onSettled();
      onClose();
    } catch (e) {
      pushToast({ kind: "error", title: "Settlement failed", body: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">Settle Market</h3>
        <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
          {market.homeTeam} vs {market.awayTeam}
        </p>

        <div className="my-5 grid grid-cols-2 gap-4 text-center">
          <div className="rounded-xl bg-[var(--color-bg-2)] p-3">
            <p className="text-[11px] font-semibold text-white">{market.homeTeam}</p>
            <input
              type="number"
              min={0}
              value={homeScore}
              onChange={(e) => setHomeScore(Number(e.target.value))}
              className="mono mt-2 w-16 text-center text-2xl font-black text-[var(--color-brand-500)] outline-none bg-transparent"
            />
          </div>
          <div className="rounded-xl bg-[var(--color-bg-2)] p-3">
            <p className="text-[11px] font-semibold text-white">{market.awayTeam}</p>
            <input
              type="number"
              min={0}
              value={awayScore}
              onChange={(e) => setAwayScore(Number(e.target.value))}
              className="mono mt-2 w-16 text-center text-2xl font-black text-[var(--color-brand-500)] outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[var(--color-bg-2)] py-2 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSettle}
            disabled={submitting}
            className="flex-2 rounded-lg bg-[var(--color-brand-500)] py-2 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
          >
            {submitting ? "Settling…" : "Confirm & Resolve Bets"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. User Governance Module
   ─────────────────────────────────────────────────────────────────────────── */
function UsersSection({ isAdmin }: { isAdmin?: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pushToast = useNotifications((s) => s.pushToast);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    Admin.users()
      .then((res) => setUsers(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBan = async (id: string) => {
    try {
      await Admin.ban(id);
      pushToast({ kind: "success", title: "User banned" });
      fetchUsers();
    } catch (e) {
      pushToast({ kind: "error", title: "Ban failed", body: (e as Error).message });
    }
  };

  const handleUnban = async (id: string) => {
    try {
      await Admin.unban(id);
      pushToast({ kind: "success", title: "User unbanned" });
      fetchUsers();
    } catch (e) {
      pushToast({ kind: "error", title: "Unban failed", body: (e as Error).message });
    }
  };

  const handleRoleChange = async (id: string, currentRoles: string[]) => {
    if (!isAdmin) return;
    const nextRole = currentRoles.includes("ADMIN")
      ? ["USER"]
      : currentRoles.includes("OPERATOR")
      ? ["ADMIN"]
      : ["OPERATOR"];
    try {
      await Admin.updateUserRole(id, nextRole);
      pushToast({ kind: "success", title: `Roles updated to ${nextRole.join(", ")}` });
      fetchUsers();
    } catch (e) {
      pushToast({ kind: "error", title: "Role update failed", body: (e as Error).message });
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <h3 className="mb-3 text-sm font-bold text-white">User Directory & Role Governance</h3>

      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-[var(--color-bg-1)]" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[var(--color-line-1)] text-[10px] uppercase text-[var(--color-ink-3)]">
              <tr>
                <th className="py-2">User / Wallet</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Total Bets</th>
                <th>Win Rate</th>
                <th>Volume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line-1)]">
              {users.map(({ user, stats }: any) => (
                <tr key={user.id} className="hover:bg-[var(--color-bg-1)]">
                  <td className="py-2.5">
                    <p className="mono font-bold text-white">
                      {user.username ?? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`}
                    </p>
                  </td>
                  <td>
                    <span
                      onClick={() => handleRoleChange(user.id, user.roles)}
                      className={`mono cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold ${
                        user.roles.includes("ADMIN")
                          ? "bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]"
                          : user.roles.includes("OPERATOR")
                          ? "bg-[var(--color-warn)]/20 text-[var(--color-warn)]"
                          : "bg-[var(--color-bg-3)] text-white"
                      }`}
                    >
                      {user.roles.join(", ")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`mono rounded px-2 py-0.5 text-[10px] font-bold ${
                        user.isBanned ? "bg-[var(--color-live)]/20 text-[var(--color-live)]" : "text-white"
                      }`}
                    >
                      {user.isBanned ? "BANNED" : "ACTIVE"}
                    </span>
                  </td>
                  <td className="mono">{stats?.totalBets ?? 0}</td>
                  <td className="mono">{((stats?.winRate ?? 0) * 100).toFixed(0)}%</td>
                  <td className="mono">${stats?.totalWagered ?? "0.00"}</td>
                  <td>
                    {user.isBanned ? (
                      <button
                        onClick={() => handleUnban(user.id)}
                        className="rounded bg-[var(--color-brand-500)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--color-brand-500)]"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBan(user.id)}
                        className="rounded bg-[var(--color-live)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--color-live)]"
                      >
                        Ban
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
