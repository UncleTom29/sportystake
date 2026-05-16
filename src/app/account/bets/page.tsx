"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ZapIcon, TrophyIcon, CloseIcon } from "@/components/icons/UIIcons";

type BetStatus = "WON" | "LOST" | "PENDING" | "CANCELLED" | "CASHED";

type Bet = {
  id: string;
  match: string;
  league: string;
  selection: string;
  odds: number;
  amount: number;
  potentialPayout: number;
  status: BetStatus;
  placedAt: string;
  settledAt?: string;
  txHash?: string;
  isLive?: boolean;
  score?: string;
  isParlay?: boolean;
  parlayLegs?: { match: string; selection: string; odds: number; won: boolean | null }[];
};

const MOCK_BETS: Bet[] = [
  {
    id: "b1", match: "Chelsea vs Liverpool", league: "Premier League",
    selection: "Draw", odds: 3.20, amount: 50, potentialPayout: 160,
    status: "WON", placedAt: "2026-05-16 18:00", settledAt: "2026-05-16 20:45",
    txHash: "0xabc…def1",
  },
  {
    id: "b2", match: "Arsenal vs Man City", league: "Premier League",
    selection: "Arsenal Win", odds: 2.85, amount: 100, potentialPayout: 285,
    status: "PENDING", placedAt: "2026-05-16 19:00", isLive: true, score: "1–0 67'",
  },
  {
    id: "b3", match: "Bayern vs Dortmund", league: "Bundesliga",
    selection: "Over 2.5 Goals", odds: 1.72, amount: 25, potentialPayout: 43,
    status: "LOST", placedAt: "2026-05-15 20:00", settledAt: "2026-05-15 22:00",
    txHash: "0xabc…def2",
  },
  {
    id: "b4", match: "Champions League Parlay", league: "Multi-league",
    selection: "3-leg accumulator", odds: 14.8, amount: 20, potentialPayout: 296,
    status: "WON", placedAt: "2026-05-14 18:00", settledAt: "2026-05-14 22:00",
    txHash: "0xabc…def3", isParlay: true,
    parlayLegs: [
      { match: "PSG vs Real Madrid", selection: "PSG Win", odds: 2.10, won: true },
      { match: "Inter vs Milan", selection: "Inter Win", odds: 2.40, won: true },
      { match: "Man United vs Spurs", selection: "Over 2.5", odds: 1.87, won: true },
    ],
  },
  {
    id: "b5", match: "Lakers vs Celtics", league: "NBA",
    selection: "Boston Celtics ML", odds: 1.78, amount: 50, potentialPayout: 89,
    status: "LOST", placedAt: "2026-05-13 01:00", settledAt: "2026-05-13 04:00",
  },
  {
    id: "b6", match: "Crash Game", league: "Casino",
    selection: "3.24×", odds: 3.24, amount: 30, potentialPayout: 97.2,
    status: "CASHED", placedAt: "2026-05-12 14:00", settledAt: "2026-05-12 14:01",
    txHash: "0xabc…def4",
  },
  {
    id: "b7", match: "Real Madrid vs Barça", league: "La Liga",
    selection: "Real Madrid Win", odds: 2.20, amount: 75, potentialPayout: 165,
    status: "CANCELLED", placedAt: "2026-05-11 20:00",
  },
];

type Filter = "ALL" | BetStatus;

const FILTERS: Filter[] = ["ALL", "PENDING", "WON", "LOST", "CANCELLED"];

const STATUS_STYLE: Record<BetStatus, { label: string; color: string; bg: string }> = {
  WON:       { label: "Won",       color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.08)" },
  LOST:      { label: "Lost",      color: "var(--color-live)",      bg: "rgba(255,45,45,0.08)" },
  PENDING:   { label: "Pending",   color: "var(--color-warn)",      bg: "rgba(255,176,32,0.08)" },
  CANCELLED: { label: "Cancelled", color: "var(--color-ink-3)",     bg: "rgba(255,255,255,0.04)" },
  CASHED:    { label: "Cashed",    color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.08)" },
};

const total = MOCK_BETS.reduce((s, b) => s + b.amount, 0);
const won = MOCK_BETS.filter((b) => b.status === "WON" || b.status === "CASHED");
const netPnl = won.reduce((s, b) => s + b.potentialPayout - b.amount, 0) -
  MOCK_BETS.filter((b) => b.status === "LOST").reduce((s, b) => s + b.amount, 0);

export default function MyBetsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    MOCK_BETS.filter((b) => filter === "ALL" || b.status === filter),
    [filter]
  );

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/account" className="flex items-center gap-1 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          Account
        </Link>
        <span>/</span>
        <span className="text-white">My Bets</span>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <SummaryCard label="Total bets" value={String(MOCK_BETS.length)} />
        <SummaryCard label="Won" value={String(won.length)} accent="var(--color-brand-500)" />
        <SummaryCard label="Lost" value={String(MOCK_BETS.filter((b) => b.status === "LOST").length)} accent="var(--color-live)" />
        <SummaryCard label="Total staked" value={`$${total.toFixed(2)}`} />
        <SummaryCard
          label="Net P&L"
          value={`${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)}`}
          accent={netPnl >= 0 ? "var(--color-brand-500)" : "var(--color-live)"}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 flex-1 rounded text-[12px] font-semibold transition-colors ${
              filter === f ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            {f}
            {f !== "ALL" && (
              <span className="mono ml-1 text-[10px] opacity-70">
                {MOCK_BETS.filter((b) => b.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bets list */}
      <div className="space-y-2">
        {filtered.map((bet) => {
          const style = STATUS_STYLE[bet.status];
          const expanded = expandedId === bet.id;
          return (
            <div
              key={bet.id}
              className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]"
              style={{ borderLeftColor: style.color, borderLeftWidth: 3 }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{bet.league}</span>
                      {bet.isLive && (
                        <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] animate-pulse" />
                          LIVE {bet.score}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-white">{bet.match}</p>
                    <p className="text-[13px] text-[var(--color-ink-2)]">
                      <span className="font-semibold">{bet.selection}</span>
                      <span className="mx-1">@</span>
                      <span className="mono font-bold text-[var(--color-warn)]">{bet.odds.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className="mono inline-block rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                    <p className="mono mt-1 text-[12px] text-[var(--color-ink-3)]">${bet.amount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
                  <span className="text-[var(--color-ink-3)]">Stake: <span className="mono font-bold text-white">${bet.amount.toFixed(2)}</span></span>
                  <span className="text-[var(--color-ink-3)]">
                    {bet.status === "WON" || bet.status === "CASHED" ? "Won" : "Potential"}:
                    <span className="mono font-bold ml-1" style={{ color: style.color }}>
                      ${bet.potentialPayout.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-[var(--color-ink-3)]">{bet.placedAt}</span>
                  {bet.txHash && (
                    <span className="mono text-[var(--color-info)] cursor-pointer hover:underline">{bet.txHash}</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {(bet.status === "WON" || bet.status === "CASHED") && (
                    <button className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
                      <ZapIcon className="h-3.5 w-3.5" />
                      Claim ${bet.potentialPayout.toFixed(2)}
                    </button>
                  )}
                  {bet.isParlay && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : bet.id)}
                      className="flex h-8 items-center gap-1 rounded-md border border-[var(--color-line-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
                    >
                      {expanded ? <CloseIcon className="h-3.5 w-3.5" /> : <TrophyIcon className="h-3.5 w-3.5" />}
                      {expanded ? "Hide legs" : `View ${bet.parlayLegs?.length} legs`}
                    </button>
                  )}
                </div>

                {/* Parlay legs */}
                {expanded && bet.parlayLegs && (
                  <div className="mt-3 space-y-1.5 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
                    {bet.parlayLegs.map((leg, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span>{leg.won === true ? "✅" : leg.won === false ? "❌" : "⏳"}</span>
                        <span className="flex-1 text-[var(--color-ink-2)]">{leg.match} — {leg.selection}</span>
                        <span className="mono font-bold text-[var(--color-warn)]">{leg.odds.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] py-16 text-center">
            <TrophyIcon className="h-8 w-8 text-[var(--color-ink-4)]" />
            <p className="text-[13px] text-[var(--color-ink-2)]">No bets in this category</p>
            <Link href="/sportsbook" className="text-[12px] text-[var(--color-brand-500)] hover:underline">Browse markets →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono mt-1 text-lg font-black" style={{ color: accent ?? "white" }}>{value}</p>
    </div>
  );
}
