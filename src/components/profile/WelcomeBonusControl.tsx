"use client";

import { useState, useEffect } from "react";
import { GiftIcon, BadgeCheck, ZapIcon, ShieldIcon } from "@/components/icons/UIIcons";
import { Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface BonusStatus {
  bonusOptIn: boolean;
  bonusStatus: "IDLE" | "ACTIVE" | "COMPLETED" | "EXPIRED" | "FORFEITED";
  bonusBalanceUsdc: number;
  initialBonusUsdc: number;
  bonusRolloverWageredUsdc: number;
  rolloverTargetUsdc: number;
  rolloverProgressPercent: number;
  bonusExpiresAt: string | null;
  daysRemaining: number;
}

export default function WelcomeBonusControl() {
  const [status, setStatus] = useState<BonusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchBonusStatus = () => {
    fetch("/api/bonus/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.status) {
          setStatus(data.data.status);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBonusStatus();
  }, []);

  const handleToggleOptIn = async (enabled: boolean) => {
    setToggling(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bonus/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setMsg(data.data.message);
        fetchBonusStatus();
      } else {
        setMsg(data.message || "Failed to update bonus settings");
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="h-36 w-full animate-pulse rounded-xl bg-[var(--color-bg-2)]/60" />;
  }

  const isOptedIn = status?.bonusOptIn ?? false;
  const bonusStatus = status?.bonusStatus ?? "IDLE";
  const isRolloverActive = bonusStatus === "ACTIVE";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-5 md:p-6 shadow-xl">
      <div className="bg-mesh absolute inset-0 opacity-50 pointer-events-none" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line-1)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <GiftIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">$2,000 Welcome Bonus</h3>
                <Badge variant={bonusStatus === "COMPLETED" ? "brand" : isRolloverActive ? "warn" : "neutral"}>
                  {bonusStatus === "IDLE" && "OPTIONAL"}
                  {bonusStatus === "ACTIVE" && "ROLLOVER ACTIVE"}
                  {bonusStatus === "COMPLETED" && "COMPLETED"}
                  {bonusStatus === "EXPIRED" && "EXPIRED"}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-ink-3)]">100% First On-Chain Wager Match up to $2,000 USDC</p>
            </div>
          </div>

          {/* Opt-in Toggle */}
          {bonusStatus === "IDLE" && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="text-[12px] font-bold text-white">
                {isOptedIn ? "Bonus Enabled" : "Enable Bonus"}
              </span>
              <button
                type="button"
                onClick={() => void handleToggleOptIn(!isOptedIn)}
                disabled={toggling}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOptedIn ? "bg-[var(--color-brand-500)]" : "bg-[var(--color-bg-3)]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isOptedIn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          )}
        </div>

        {msg && (
          <p className="mt-3 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
            {msg}
          </p>
        )}

        {/* Active Rollover Dashboard */}
        {isRolloverActive && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Virtual Bonus Balance</span>
                <p className="mono text-lg font-black text-[var(--color-brand-500)] mt-0.5">
                  ${status?.bonusBalanceUsdc.toFixed(2)} USDC
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Initial Bonus Credited</span>
                <p className="mono text-lg font-black text-white mt-0.5">
                  ${status?.initialBonusUsdc.toFixed(2)} USDC
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Expiry Countdown</span>
                <p className="mono text-lg font-black text-amber-400 mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {status?.daysRemaining} Days Left
                </p>
              </div>
            </div>

            {/* 10x Rollover Progress Bar */}
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
                <span className="text-white flex items-center gap-1">
                  <ZapIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                  10x Accumulator Rollover Progress
                </span>
                <span className="mono text-[var(--color-brand-500)]">
                  ${status?.bonusRolloverWageredUsdc.toFixed(2)} / ${status?.rolloverTargetUsdc.toFixed(2)} ({status?.rolloverProgressPercent}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[var(--color-brand-500)] transition-all duration-300"
                  style={{ width: `${status?.rolloverProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Rollover Rules Checklist */}
            <div className="grid gap-2 text-[11px] text-[var(--color-ink-2)] sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Sportsbook Accumulators (Min 10 Selections)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Min 3 legs with odds ≥ 1.60 per ticket</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>10-Day Deadline from registration/credit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>Completion Cap: Transfers up to initial bonus amount</span>
              </div>
            </div>
          </div>
        )}

        {/* Qualification Terms Breakdown */}
        {bonusStatus === "IDLE" && (
          <div className="mt-4 space-y-2 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 text-[12px] text-[var(--color-ink-2)]">
            <p className="font-bold text-white">How to Qualify & Claim Your Bonus:</p>
            <ul className="space-y-1.5 list-disc list-inside text-[11px]">
              <li>Enable the Welcome Bonus above before placing your first wager.</li>
              <li>Place your first on-chain wager with <strong>total odds &gt; 2.00</strong> and at least <strong>3 selections with odds ≥ 1.60</strong>.</li>
              <li>Upon successful wager placement, you receive a <strong>100% bonus match up to $2,000 USDC</strong> in your Virtual Bonus Account.</li>
              <li>Complete 10x rollover on accumulator bets (10+ legs, 3+ legs ≥ 1.60) within 10 days to transfer up to initial bonus amount to main wallet.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
