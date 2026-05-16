"use client";
import { useState } from "react";
import Link from "next/link";
import { TrophyIcon, ZapIcon, FlameIcon, BadgeCheck, SparkleIcon, TrendUp } from "@/components/icons/UIIcons";
import SectionHeader from "@/components/ui/SectionHeader";

type Period = "weekly" | "monthly" | "alltime";

const LEADERBOARD = [
  { rank: 1, handle: "CryptoTipster.eth", address: "0x4a2f…91bc", color: "#f59e0b", verified: true,
    bets: 284, winRate: 67.2, volume: 42500, pnl: 9425, roi: 22.4, streak: 8 },
  { rank: 2, handle: "GoalMachine99", address: "0x7f1c…22d1", color: "#22c55e", verified: false,
    bets: 198, winRate: 61.5, volume: 28400, pnl: 5144, roi: 18.1, streak: 5 },
  { rank: 3, handle: "OddsWizard.arc", address: "0x9e3a…b421", color: "#8b5cf6", verified: true,
    bets: 156, winRate: 59.8, volume: 21000, pnl: 3108, roi: 14.8, streak: 3 },
  { rank: 4, handle: "SlateBreaker", address: "0x2d8f…7c90", color: "#06b6d4", verified: false,
    bets: 203, winRate: 58.3, volume: 18500, pnl: 2072, roi: 11.2, streak: 0 },
  { rank: 5, handle: "QuantBet_", address: "0x5c1b…4a33", color: "#f43f5e", verified: false,
    bets: 142, winRate: 56.7, volume: 14800, pnl: 1450, roi: 9.8, streak: 4 },
  { rank: 6, handle: "ArcWhale", address: "0x8b7e…0d14", color: "#3b82f6", verified: false,
    bets: 88, winRate: 55.1, volume: 62000, pnl: 4340, roi: 7.0, streak: 1 },
  { rank: 7, handle: "ValueHunter", address: "0x1f3d…8a52", color: "#10b981", verified: true,
    bets: 321, winRate: 54.8, volume: 9200, pnl: 1012, roi: 11.0, streak: 2 },
  { rank: 8, handle: "LaLigaKing", address: "0xdc4a…2f91", color: "#f97316", verified: false,
    bets: 77, winRate: 53.2, volume: 7400, pnl: 777, roi: 10.5, streak: 0 },
  { rank: 9, handle: "Nakamoto_B", address: "0x6a2c…5e18", color: "#ec4899", verified: false,
    bets: 264, winRate: 52.7, volume: 5100, pnl: 561, roi: 11.0, streak: 3 },
  { rank: 10, handle: "GrindMode", address: "0x3f8b…9c07", color: "#14b8a6", verified: false,
    bets: 189, winRate: 51.9, volume: 4200, pnl: 420, roi: 10.0, streak: 1 },
];

const CURRENT_USER_RANK = 23;
const CURRENT_USER = { handle: "CryptoStaker", address: "0x4a…91bc", bets: 47, winRate: 60.0, volume: 2450, pnl: 312.8, roi: 12.8, streak: 4 };

const PERIOD_LABELS: Record<Period, string> = { weekly: "This Week", monthly: "This Month", alltime: "All Time" };

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("weekly");

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-4 md:px-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,176,32,0.1),transparent_60%)]" />
        <div className="relative text-center">
          <TrophyIcon className="mx-auto h-10 w-10 text-[var(--color-warn)]" />
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">Leaderboard</h1>
          <p className="mt-2 text-[13px] text-[var(--color-ink-3)]">Top bettors by net P&L. Updated every 5 minutes.</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="mt-4 flex items-center gap-1 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
        {(["weekly", "monthly", "alltime"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 h-9 rounded text-[13px] font-semibold transition-colors ${
              period === p ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[1, 0, 2].map((idx) => {
          const p = LEADERBOARD[idx];
          const heights = ["h-32", "h-40", "h-28"];
          const heightMap = [heights[1], heights[0], heights[2]];
          return (
            <div key={p.rank} className={`relative flex flex-col items-center justify-end rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] pt-4 pb-4 ${heightMap[idx]}`}>
              <div className="absolute -top-5 flex h-10 w-10 items-center justify-center text-2xl">
                {RANK_MEDAL[p.rank]}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-black" style={{ background: `${p.color}20`, border: `2px solid ${p.color}` }}>
                {p.handle[0]}
              </div>
              <p className="mt-1.5 max-w-[90px] truncate text-center text-[12px] font-bold text-white">{p.handle}</p>
              <p className="mono text-[11px] font-bold" style={{ color: "var(--color-brand-500)" }}>+${p.pnl.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">{p.winRate}% WR</p>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        {/* Header */}
        <div className="grid grid-cols-[48px_1fr_80px_80px_100px_90px] items-center border-b border-[var(--color-line-1)] px-4 py-2.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
          <span>#</span>
          <span>Player</span>
          <span className="hidden md:block text-right">Bets</span>
          <span className="hidden md:block text-right">Win %</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Net P&L</span>
        </div>

        {LEADERBOARD.map((p) => (
          <Link
            key={p.rank}
            href={`/profile/${encodeURIComponent(p.handle)}`}
            className="grid grid-cols-[48px_1fr_80px_80px_100px_90px] items-center border-b border-[var(--color-line-1)] px-4 py-3 text-[13px] last:border-0 hover:bg-[var(--color-bg-3)] transition-colors"
          >
            <span className="mono font-black text-[var(--color-ink-3)]">
              {RANK_MEDAL[p.rank] ?? p.rank}
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black" style={{ background: `${p.color}20`, color: p.color }}>
                {p.handle[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate font-bold text-white">{p.handle}</span>
                  {p.verified && <BadgeCheck className="h-3 w-3 shrink-0 text-[var(--color-info)]" />}
                </div>
                {p.streak >= 3 && (
                  <span className="mono text-[10px] text-[var(--color-warn)]">🔥 {p.streak} streak</span>
                )}
              </div>
            </div>
            <span className="mono hidden md:block text-right text-[var(--color-ink-2)]">{p.bets}</span>
            <span className="mono hidden md:block text-right text-white">{p.winRate}%</span>
            <span className="mono text-right text-[var(--color-ink-2)]">${(p.volume / 1000).toFixed(0)}K</span>
            <span className="mono text-right font-bold text-[var(--color-brand-500)]">+${p.pnl.toLocaleString()}</span>
          </Link>
        ))}
      </div>

      {/* Current user row */}
      <div className="mt-3 grid grid-cols-[48px_1fr_80px_80px_100px_90px] items-center rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/5 px-4 py-3 text-[13px]">
        <span className="mono font-black text-[var(--color-ink-3)]">#{CURRENT_USER_RANK}</span>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-500)]/20 text-sm font-black text-[var(--color-brand-500)]">
            Y
          </div>
          <span className="font-bold text-white">You</span>
          <span className="rounded-md bg-[var(--color-brand-500)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-brand-500)]">You</span>
        </div>
        <span className="mono hidden md:block text-right text-[var(--color-ink-2)]">{CURRENT_USER.bets}</span>
        <span className="mono hidden md:block text-right text-white">{CURRENT_USER.winRate}%</span>
        <span className="mono text-right text-[var(--color-ink-2)]">${(CURRENT_USER.volume / 1000).toFixed(1)}K</span>
        <span className="mono text-right font-bold text-[var(--color-brand-500)]">+${CURRENT_USER.pnl.toFixed(0)}</span>
      </div>

      {/* Win more bets CTA */}
      <div className="mt-6 flex items-center gap-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        <SparkleIcon className="h-6 w-6 shrink-0 text-[var(--color-brand-500)]" />
        <div className="flex-1">
          <p className="font-bold text-white">Climb the ranks</p>
          <p className="text-[12px] text-[var(--color-ink-3)]">Every winning bet improves your position. Your P&L resets at the start of each period.</p>
        </div>
        <Link href="/sportsbook" className="shrink-0 rounded-md bg-[var(--color-brand-500)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-0)]">
          Bet now
        </Link>
      </div>
    </div>
  );
}
