"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { useNotifications } from "@/lib/notificationStore";
import { BetSlip, SocialApi } from "@/lib/api-client";
import {
  FlameIcon,
  TrophyIcon,
  BadgeCheck,
  CopyIcon,
  HeartIcon,
  TicketIcon,
} from "@/components/icons/UIIcons";

export default function SocialPage() {
  const [slips, setSlips] = useState<any[]>([]);
  const [tipsters, setTipsters] = useState<any[]>([]);
  const [loadingSlips, setLoadingSlips] = useState(true);
  const [loadingTipsters, setLoadingTipsters] = useState(true);
  const [feedFilter, setFeedFilter] = useState<"all" | "parlay" | "won">("all");
  const [searchCode, setSearchCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

  const appendSelections = useBetSlip((s) => s.appendSelections);
  const pushToast = useNotifications((s) => s.pushToast);

  const fetchSocialData = useCallback(() => {
    setLoadingSlips(true);
    setLoadingTipsters(true);

    SocialApi.feed(50)
      .then((res) => setSlips(res.items))
      .catch(() => {})
      .finally(() => setLoadingSlips(false));

    SocialApi.tipsters()
      .then((res) => setTipsters(res.items))
      .catch(() => {})
      .finally(() => setLoadingTipsters(false));
  }, []);

  useEffect(() => {
    fetchSocialData();
  }, [fetchSocialData]);

  const handleCopySlip = (slip: any) => {
    const converted: BetSelection[] = [
      {
        matchId: slip.marketId || `social-${slip.id}`,
        matchLabel: slip.marketLabel || "Match",
        market: "1X2",
        selection: slip.selectionLabel || "Selection",
        odds: Number(slip.oddsX1000 ? slip.oddsX1000 / 1000 : 2.0),
        stake: Math.max(1, Math.round(Number(slip.amount || 10))),
      },
    ];

    appendSelections(converted);
    pushToast({
      kind: "success",
      title: "Picks Tailed! 🎟️",
      body: `Copied ticket from ${slip.user?.username || "user"} to your betslip`,
    });
  };

  const handleLoadByCode = async () => {
    if (!searchCode.trim()) return;
    setLoadingCode(true);
    try {
      const codeClean = searchCode.trim().toUpperCase();
      const res = await BetSlip.loadBooked(codeClean);
      if (res.selections && res.selections.length) {
        appendSelections(res.selections);
        pushToast({
          kind: "success",
          title: `Ticket ${codeClean} Loaded!`,
          body: `Added ${res.selections.length} selections to your betslip`,
        });
        setSearchCode("");
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Ticket Not Found", body: (e as Error).message });
    } finally {
      setLoadingCode(false);
    }
  };

  const filteredSlips = slips.filter((s) => {
    if (feedFilter === "won") return s.status === "WON";
    return true;
  });

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-brand-500)]/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="mono rounded-full bg-[var(--color-brand-500)]/15 px-3 py-1 text-[11px] font-bold uppercase text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
              LIVE SOCIAL BETTING FEED
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              Tail Verified Bettors & Share Tickets
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Explore public bets placed across the platform, follow top-ranked crypto tipsters, or load any 6-character booking code.
            </p>
          </div>

          {/* Booking Code Quick Loader */}
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3.5 shadow-xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
              <TicketIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
              Load Share Ticket Code
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleLoadByCode()}
                placeholder="Enter 6-char code (e.g. 7X9K2W)"
                className="mono h-10 w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-3 text-[13px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)] focus:border-[var(--color-brand-500)]"
              />
              <button
                onClick={handleLoadByCode}
                disabled={loadingCode || !searchCode.trim()}
                className="h-10 shrink-0 rounded-lg bg-[var(--color-brand-500)] px-4 text-[12px] font-bold text-[var(--color-bg-0)] transition-all hover:bg-[var(--color-brand-400)] disabled:opacity-40"
              >
                {loadingCode ? "Loading…" : "Load"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        {/* Left Column: Community Feed */}
        <div className="space-y-4">
          {/* Feed Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
            <div className="flex items-center gap-2">
              <FlameIcon className="h-4 w-4 text-[var(--color-warn)]" />
              <span className="text-sm font-bold text-white">Live Public Bets Feed</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { id: "all", label: "🔥 All Live Shares" },
                { id: "won", label: "🏆 Winning Bets" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFeedFilter(f.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                    feedFilter === f.id
                      ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow"
                      : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)] hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shared Slips List */}
          {loadingSlips ? (
            <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-bg-2)]" />
          ) : filteredSlips.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] text-[13px] text-[var(--color-ink-3)]">
              <TicketIcon className="mx-auto h-8 w-8 text-[var(--color-brand-500)] mb-2" />
              No public bets placed yet. Be the first to share a ticket or place a public bet in Sportsbook!
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSlips.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg transition-all hover:border-[var(--color-line-2)]"
                >
                  {/* Card Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-500)]/20 text-xs font-black text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                        {(s.user?.username || s.user?.walletAddress || "U").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-bold text-white">
                            {s.user?.username ? `@${s.user.username}` : `${s.user?.walletAddress?.slice(0, 6)}…${s.user?.walletAddress?.slice(-4)}`}
                          </p>
                          {s.user?.username && <BadgeCheck className="h-4 w-4 text-[var(--color-info)]" />}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-3)]">
                          Placed {new Date(s.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`mono rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === "WON"
                          ? "bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]"
                          : s.status === "LOST"
                          ? "bg-[var(--color-live)]/20 text-[var(--color-live)]"
                          : "bg-[var(--color-bg-3)] text-white"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  {/* Selection Detail */}
                  <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-1)] p-3 ring-1 ring-white/5">
                    <div>
                      <p className="text-[11px] text-[var(--color-ink-3)]">{s.marketLabel}</p>
                      <p className="text-[13px] font-bold text-white mt-0.5">{s.selectionLabel}</p>
                    </div>
                    <span className="mono text-sm font-black text-[var(--color-brand-500)]">
                      {(s.oddsX1000 / 1000).toFixed(2)}
                    </span>
                  </div>

                  {/* Footer Action Bar */}
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line-1)] pt-3 text-[12px]">
                    <span className="text-[var(--color-ink-3)]">
                      Stake: <span className="mono font-bold text-white">${s.amount} USDC</span>
                    </span>
                    <button
                      onClick={() => handleCopySlip(s)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)] shadow-md transition-all hover:bg-[var(--color-brand-400)] active:scale-95"
                    >
                      <CopyIcon className="h-3.5 w-3.5" /> Tail Pick
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Top Database Tipsters */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrophyIcon className="h-4 w-4 text-[var(--color-warn)]" />
                <h3 className="text-sm font-bold text-white">Top Database Tipsters</h3>
              </div>
              <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--color-brand-500)] hover:underline">
                Full Leaderboard →
              </Link>
            </div>

            {loadingTipsters ? (
              <div className="h-32 animate-pulse rounded-xl bg-[var(--color-bg-1)]" />
            ) : tipsters.length === 0 ? (
              <p className="text-[12px] text-[var(--color-ink-3)] p-4 text-center">No active tipsters yet.</p>
            ) : (
              <div className="space-y-3">
                {tipsters.map((t) => (
                  <div
                    key={t.userId}
                    className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 transition-all hover:border-[var(--color-line-2)]"
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="mono flex h-6 w-6 items-center justify-center rounded bg-[var(--color-bg-3)] text-[10px] font-black text-white">
                          #{t.rank}
                        </span>
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white"
                          style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}99)` }}
                        >
                          {t.handle.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="truncate text-[12px] font-bold text-white">{t.handle}</p>
                            {t.verified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-info)]" />}
                          </div>
                        </div>
                      </div>

                      <span className="mono text-[11px] font-bold text-[var(--color-brand-500)]">
                        {t.winRate}% WR
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
