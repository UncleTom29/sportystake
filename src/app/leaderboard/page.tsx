"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrophyIcon,
  BadgeCheck,
} from "@/components/icons/UIIcons";
import {
  Crown,
  Medal,
  Trophy,
  Dices,
  TrendingUp,
  Flame,
  Users,
} from "lucide-react";
import { useWallet } from "@/lib/walletStore";
import { LeaderboardApi } from "@/lib/api-client";

type Category = "sports" | "casino" | "roi" | "streaks" | "referrals";
type Period = "weekly" | "monthly" | "alltime";

interface LeaderboardUser {
  rank: number;
  userId: string;
  handle: string;
  address: string;
  color: string;
  verified: boolean;
  bets: number;
  winRate: number;
  volume: number;
  pnl: number;
  roi: number;
  streak: number;
  referredUsers?: number;
  avatar?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/40">
        <Crown className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/20 text-slate-200 ring-1 ring-slate-300/40">
        <Medal className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/40">
        <Medal className="h-3.5 w-3.5" />
      </div>
    );
  }
  return <span className="mono text-[var(--color-ink-3)] font-bold">#{rank}</span>;
}

/**
 * Real countdown to the period boundary (UTC), replacing what used to be a
 * hardcoded "2d 14h 38m" string that never changed. Weekly resets Monday
 * 00:00 UTC; monthly resets on the 1st. All-time has no boundary.
 */
function timeUntilPeriodEnd(period: Period): string | null {
  if (period === "alltime") return null;
  const now = new Date();
  let end: Date;
  if (period === "weekly") {
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daysUntilMonday = (8 - end.getUTCDay()) % 7 || 7;
    end.setUTCDate(end.getUTCDate() + daysUntilMonday);
  } else {
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return "Resetting…";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function LeaderboardPage() {
  const { address } = useWallet();
  const [category, setCategory] = useState<Category>("sports");
  const [period, setPeriod] = useState<Period>("weekly");
  const [items, setItems] = useState<LeaderboardUser[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setCountdown(timeUntilPeriodEnd(period));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [period]);

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    LeaderboardApi.get({ category, period })
      .then((res) => {
        setItems(res.items);
        setCurrentUser(res.currentUser);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const topThree = items.slice(0, 3);
  const podiumDisplay = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1200px] px-3 py-5 md:px-5">
      {/* Hero Competition Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,231,1,0.12),transparent_70%)]" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="mono rounded-full bg-[var(--color-brand-500)]/15 px-3 py-1 text-[11px] font-bold uppercase text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                {period === "weekly" ? "WEEKLY" : period === "monthly" ? "MONTHLY" : "ALL-TIME"} RANKINGS
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-live)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-live)] animate-pulse" />
                Live Database Standings
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              Global Bettor Leaderboard
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)] max-w-xl">
              Track your rank by net PnL, volume, ROI, streaks, and referrals. Aggregated 100% on-chain and in real-time.
            </p>
          </div>

          {/* Countdown to period reset */}
          {countdown && (
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 shadow-lg text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                {period === "weekly" ? "Weekly" : "Monthly"} Round Resets In
              </p>
              <p className="mono text-2xl font-black text-white mt-0.5">{countdown}</p>
            </div>
          )}
        </div>
      </div>

      {/* User's Live Position Banner */}
      {currentUser && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/5 p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-500)]/20 text-sm font-black text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/40">
              #{currentUser.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Your Rank: #{currentUser.rank}</span>
                <span className="mono rounded bg-[var(--color-brand-500)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand-500)]">
                  Active Bettor
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-3)]">
                Wallet: <code className="mono text-white">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connected"}</code> · PnL:{" "}
                <strong className={currentUser.pnl >= 0 ? "text-[var(--color-brand-500)]" : "text-[var(--color-live)]"}>
                  {currentUser.pnl >= 0 ? "+" : ""}${currentUser.pnl.toLocaleString()} USDC
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] hidden sm:block">
              <p className="text-[var(--color-ink-3)]">Wagered Volume</p>
              <p className="mono font-bold text-white">${currentUser.volume.toLocaleString()}</p>
            </div>
            <Link
              href="/sportsbook"
              className="rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all"
            >
              Climb Rank →
            </Link>
          </div>
        </div>
      )}

      {/* Category & Period Controls */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1.5 scrollbar-none">
          {[
            { id: "sports", label: "Sports Volume", Icon: Trophy, color: "text-emerald-400" },
            { id: "casino", label: "Casino High-Rollers", Icon: Dices, color: "text-purple-400" },
            { id: "roi", label: "Top ROI %", Icon: TrendingUp, color: "text-cyan-400" },
            { id: "streaks", label: "Win Streaks", Icon: Flame, color: "text-amber-400" },
            { id: "referrals", label: "Top Referrers", Icon: Users, color: "text-blue-400" },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id as any)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[12px] font-bold transition-all ${
                category === c.id
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-md"
                  : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
              }`}
            >
              <c.Icon className={`h-3.5 w-3.5 ${category === c.id ? "text-[var(--color-bg-0)]" : c.color}`} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1.5">
          {[
            { id: "weekly", label: "This Week" },
            { id: "monthly", label: "This Month" },
            { id: "alltime", label: "All Time" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                period === p.id
                  ? "bg-[var(--color-bg-3)] text-white"
                  : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Winner Podium */}
      {!loading && podiumDisplay.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          {podiumDisplay.map((p, idx) => {
            const podiumOrder = [2, 1, 3];
            const actualRank = podiumOrder[idx];
            const isFirst = actualRank === 1;

            return (
              <div
                key={p.userId}
                className={`relative flex flex-col items-center justify-end rounded-2xl border p-4 text-center transition-all ${
                  isFirst
                    ? "border-[var(--color-brand-500)]/50 bg-gradient-to-b from-[var(--color-brand-500)]/15 to-[var(--color-bg-2)] shadow-2xl scale-105"
                    : "border-[var(--color-line-1)] bg-[var(--color-bg-2)]"
                }`}
              >
                <div className="absolute -top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-1)] shadow-lg ring-1 ring-white/10">
                  {actualRank === 1 ? (
                    <Crown className="h-5 w-5 text-amber-400" />
                  ) : actualRank === 2 ? (
                    <Medal className="h-5 w-5 text-slate-300" />
                  ) : (
                    <Medal className="h-5 w-5 text-amber-600" />
                  )}
                </div>

                <div
                  className="mt-3 flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white shadow-lg ring-2 ring-white/20"
                  style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}
                >
                  {p.handle[0]}
                </div>

                <div className="mt-2.5 min-w-0">
                  <div className="flex items-center justify-center gap-1">
                    <p className="truncate text-[13px] font-bold text-white max-w-[120px]">{p.handle}</p>
                    {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-info)] shrink-0" />}
                  </div>
                  <p className="mono text-[14px] font-black text-[var(--color-brand-500)] mt-0.5">
                    {p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-3)]">{p.winRate}% Win Rate</p>
                </div>

                <div className="mt-3 w-full rounded-lg bg-[var(--color-bg-1)] py-1.5 text-[10px] font-bold text-[var(--color-warn)]">
                  #{actualRank} · ${p.volume.toLocaleString()} volume
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Leaderboard Directory Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] shadow-xl">
        <div className="grid grid-cols-[40px_1fr_85px_95px] items-center gap-2 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-3 text-[10px] uppercase font-bold tracking-wider text-[var(--color-ink-3)] sm:grid-cols-[50px_1fr_90px_90px_110px_110px] sm:gap-0 sm:px-4">
          <span>Rank</span>
          <span>Bettor / Wallet</span>
          <span className="hidden sm:block text-right">Bets</span>
          <span className="hidden sm:block text-right">Win Rate</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Net PnL</span>
        </div>

        {loading ? (
          <div className="h-48 animate-pulse bg-[var(--color-bg-1)]/50" />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-[var(--color-ink-3)]">
            <TrophyIcon className="mx-auto h-8 w-8 text-[var(--color-ink-4)] mb-2" />
            No recorded bets yet in this category for {period}. Be the first on the Leaderboard by placing a bet!
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line-1)]">
            {items.map((p) => (
              <div
                key={p.userId}
                className="grid grid-cols-[40px_1fr_85px_95px] items-center gap-2 px-3 py-3.5 text-[13px] transition-colors hover:bg-[var(--color-bg-1)] sm:grid-cols-[50px_1fr_90px_90px_110px_110px] sm:gap-0 sm:px-4"
              >
                <div className="flex items-center">
                  <RankBadge rank={p.rank} />
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}
                  >
                    {p.handle[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-bold text-white">{p.handle}</span>
                      {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-info)] shrink-0" />}
                    </div>
                    <span className="mono text-[10px] text-[var(--color-ink-3)]">{p.address}</span>
                  </div>
                </div>

                <span className="mono hidden sm:block text-right text-[var(--color-ink-2)]">{p.bets}</span>
                <span className="mono hidden sm:block text-right font-semibold text-white">{p.winRate}%</span>
                <span className="mono text-right text-[var(--color-ink-2)]">${p.volume.toLocaleString()}</span>
                <span className={`mono text-right font-black ${p.pnl >= 0 ? "text-[var(--color-brand-500)]" : "text-[var(--color-live)]"}`}>
                  {p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
