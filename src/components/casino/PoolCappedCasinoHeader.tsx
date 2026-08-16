"use client";

import { useEffect, useState, useCallback } from "react";
import { CasinoPoolApi } from "@/lib/api-client";
import { ZapIcon, TrophyIcon, ShieldIcon } from "@/components/icons/UIIcons";

export default function PoolCappedCasinoHeader() {
  const [roundState, setRoundState] = useState<any>(null);

  const fetchRound = useCallback(() => {
    CasinoPoolApi.getRound()
      .then(setRoundState)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 1000);
    return () => clearInterval(interval);
  }, [fetchRound]);

  const sec = roundState?.secondsRemaining ?? 900;
  const minutes = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  const formattedTimer = `${String(minutes).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`;
  const totalDep = roundState?.totalDeposits ?? 0;
  const winners = roundState?.recentWinners ?? [];

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-5 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line-1)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <ZapIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">
                Round #{roundState?.roundId ?? 101}
              </h2>
              <span className="mono flex items-center gap-1 rounded-full bg-[var(--color-brand-500)]/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
                24/7 CONTINUOUS RUN LOOP
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
              15-minute continuous round cycles · Provably fair randomized outcome distribution
            </p>
          </div>
        </div>

        {/* Timer Gauge */}
        <div className="flex items-center gap-3 rounded-xl bg-[var(--color-bg-1)] p-2.5 border border-[var(--color-line-1)]">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Round Countdown</p>
            <p className="mono text-lg font-black text-[var(--color-warn)]">{formattedTimer}</p>
          </div>
          <div className="h-8 w-2 overflow-hidden rounded-full bg-[var(--color-bg-0)]">
            <div
              className="w-full bg-[var(--color-warn)] transition-all duration-300 rounded-full"
              style={{ height: `${(sec / 900) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
          <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Total Casino Vault Liquidity</span>
          <p className="mono text-lg font-black text-white mt-0.5">${(roundState?.totalVaultLiquidity ?? 1250.0).toFixed(2)} USDC</p>
        </div>

        <div className="rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
          <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Active Bettors</span>
          <p className="mono text-lg font-black text-[var(--color-brand-500)] mt-0.5">{roundState?.playersCount ?? 0} Players</p>
        </div>

        <div className="rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
          <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Fair Multipliers</span>
          <p className="mono text-lg font-black text-white mt-0.5">Dynamic RTP</p>
        </div>

        <div className="rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
          <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Settlement Mode</span>
          <p className="mono text-lg font-black text-[var(--color-info)] mt-0.5">Instant On-Chain</p>
        </div>
      </div>

      {/* Recent Winners Ticker */}
      {winners.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] pt-1">
          <span className="mono font-bold text-[var(--color-ink-3)] shrink-0 flex items-center gap-1">
            <TrophyIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" /> Round Winners:
          </span>
          {winners.slice(0, 5).map((w: any, idx: number) => (
            <span
              key={idx}
              className="mono shrink-0 rounded-lg bg-[var(--color-bg-1)] px-2.5 py-1 text-white border border-[var(--color-line-1)]"
            >
              <strong className="text-[var(--color-brand-500)]">@{w.username}</strong> won{" "}
              <strong className="text-white">${Number(w.payout).toFixed(2)} USDC</strong> ({w.game})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
