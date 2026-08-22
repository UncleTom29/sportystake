"use client";

import { useEffect, useState, useCallback } from "react";
import { LeaderboardApi } from "@/lib/api-client";
import { TrophyIcon, FlameIcon, ZapIcon } from "@/components/icons/UIIcons";
import { Crown, Award, Medal, UserCircle2 } from "lucide-react";

export default function DailyCasinoWinnersLeaderboard() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "alltime">("daily");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    LeaderboardApi.get({ category: "casino", period })
      .then((res) => setItems(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="mt-8 rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line-1)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <TrophyIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              Daily Casino Champions & High Rollers
            </h2>
            <p className="text-[11px] text-[var(--color-ink-3)]">
              Top casino winners ranked by net profit and payout performance
            </p>
          </div>
        </div>

        {/* Period Filter Tabs */}
        <div className="flex rounded-xl bg-[var(--color-bg-1)] p-1 border border-[var(--color-line-1)]">
          {(["daily", "weekly", "alltime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-[11px] font-bold uppercase transition-all ${
                period === p
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-md"
                  : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              {p === "daily" ? "Today (24h)" : p === "weekly" ? "This Week" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-bg-1)]" />
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-[var(--color-ink-3)]">
          No casino bets recorded yet for this period. Be the first high roller on the board!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[var(--color-line-1)] text-[10px] uppercase font-bold text-[var(--color-ink-3)]">
              <tr>
                <th className="py-2">Rank</th>
                <th>Player</th>
                <th>Casino Bets</th>
                <th>Win Rate</th>
                <th>Wagered</th>
                <th>Net P&L</th>
                <th>ROI %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line-1)]">
              {items.slice(0, 10).map((item) => {
                return (
                  <tr key={item.userId || item.rank} className="hover:bg-[var(--color-bg-1)] transition-colors">
                    <td className="py-3 font-bold">
                      {item.rank === 1 ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/40">
                          <Crown className="h-3.5 w-3.5" />
                        </div>
                      ) : item.rank === 2 ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/20 text-slate-200 ring-1 ring-slate-300/40">
                          <Award className="h-3.5 w-3.5" />
                        </div>
                      ) : item.rank === 3 ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/40">
                          <Medal className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <span className="mono text-[var(--color-ink-3)]">#{item.rank}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-bg-3)] text-xs text-[var(--color-ink-2)]">
                          <UserCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white leading-none">
                            {item.username || item.handle || "Anonymous"}
                          </p>
                          <p className="mono text-[10px] text-[var(--color-ink-3)] mt-0.5">
                            {item.address ? `${item.address.slice(0, 6)}…${item.address.slice(-4)}` : "0x…"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="mono font-semibold text-white">{item.bets}</td>
                    <td className="mono font-bold text-[var(--color-brand-500)]">
                      {Number(item.winRate || 0).toFixed(1)}%
                    </td>
                    <td className="mono text-white">${Number(item.volume || 0).toFixed(2)} USDC</td>
                    <td className="mono font-bold" style={{ color: Number(item.pnl || 0) >= 0 ? "var(--color-brand-500)" : "var(--color-live)" }}>
                      {Number(item.pnl || 0) >= 0 ? "+" : ""}${Number(item.pnl || 0).toFixed(2)} USDC
                    </td>
                    <td className="mono font-bold text-violet-300">
                      {Number(item.roi || 0) >= 0 ? "+" : ""}{Number(item.roi || 0).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
