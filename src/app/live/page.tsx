"use client";
import { useState, useEffect, useRef } from "react";
import { matches } from "@/lib/mockData";
import { useBetSlip } from "@/lib/betSlipStore";
import OddsButton from "@/components/sportsbook/OddsButton";
import { LiveIcon, ZapIcon, CloseIcon, ChevronRight } from "@/components/icons/UIIcons";

const liveMatches = matches.filter((m) => m.isLive);

const EVENTS = [
  { min: 2, type: "goal", team: "home", player: "Rashford", detail: "GOAL! 1–0" },
  { min: 14, type: "yellow", team: "away", player: "Rodri", detail: "Yellow card" },
  { min: 23, type: "goal", team: "away", player: "Haaland", detail: "GOAL! 1–1" },
  { min: 45, type: "ht", team: null, player: null, detail: "Half Time" },
  { min: 54, type: "yellow", team: "home", player: "Bruno", detail: "Yellow card" },
  { min: 67, type: "goal", team: "home", player: "Salah", detail: "GOAL! 2–1" },
];

type LiveMarket = {
  type: string;
  label: string;
  selections: { label: string; odds: number }[];
};

function getLiveMarkets(m: typeof liveMatches[0]): LiveMarket[] {
  return [
    {
      type: "1X2",
      label: "Match Result",
      selections: [
        { label: m.homeTeam, odds: m.homeOdds },
        ...(m.drawOdds ? [{ label: "Draw", odds: m.drawOdds }] : []),
        { label: m.awayTeam, odds: m.awayOdds },
      ],
    },
    {
      type: "over_under_25",
      label: "Over/Under 2.5",
      selections: [
        { label: "Over 2.5", odds: m.totalOverOdds ?? 1.8 },
        { label: "Under 2.5", odds: m.totalUnderOdds ?? 2.0 },
      ],
    },
    {
      type: "btts",
      label: "Both Teams to Score",
      selections: [
        { label: "Yes", odds: 1.65 },
        { label: "No", odds: 2.15 },
      ],
    },
    {
      type: "next_goal",
      label: "Next Team to Score",
      selections: [
        { label: m.homeTeam, odds: 1.95 },
        { label: "No goal", odds: 4.5 },
        { label: m.awayTeam, odds: 2.4 },
      ],
    },
  ];
}

export default function LivePage() {
  const [selectedId, setSelectedId] = useState<string>(liveMatches[0]?.id ?? "");
  const [minute, setMinute] = useState(67);
  const [suspended, setSuspended] = useState(false);
  const { addSelection, hasSelection } = useBetSlip();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setMinute((m) => {
        if (m >= 90) return 90;
        // Randomly simulate suspension
        setSuspended(Math.random() < 0.05);
        return m + 1;
      });
    }, 10000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const selected = liveMatches.find((m) => m.id === selectedId) ?? liveMatches[0];
  const liveMarkets = selected ? getLiveMarkets(selected) : [];

  if (liveMatches.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 px-5 py-20 text-center">
        <LiveIcon className="h-8 w-8 text-[var(--color-ink-3)]" />
        <p className="text-[15px] font-semibold text-[var(--color-ink-2)]">No live matches right now</p>
        <p className="text-[13px] text-[var(--color-ink-3)]">Check back in a few minutes. Live odds update every 45 seconds.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-live)]/10 text-[var(--color-live)]">
          <LiveIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[20px] font-black tracking-tight">
            LIVE BETTING
          </h1>
          <p className="text-[12px] text-[var(--color-ink-3)]">
            <span className="mono font-bold text-[var(--color-live)]">{liveMatches.length}</span> matches in play · odds update every 45s
          </p>
        </div>
        {suspended && (
          <div className="ml-auto flex items-center gap-2 rounded-md bg-[var(--color-warn)]/10 px-3 py-1.5 text-[12px] font-bold text-[var(--color-warn)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-warn)] animate-pulse" />
            ODDS SUSPENDED
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Match List */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] px-1">Live matches</p>
          {liveMatches.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                selectedId === m.id
                  ? "border-[var(--color-live)]/40 bg-[var(--color-live)]/5"
                  : "border-[var(--color-line-1)] bg-[var(--color-bg-2)] hover:border-[var(--color-line-2)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                  {m.league}
                </span>
                <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] animate-pulse" />
                  {m.id === selectedId ? `${minute}'` : m.liveMinute}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white">{m.homeTeam}</p>
                  <p className="text-[13px] font-bold text-white">{m.awayTeam}</p>
                </div>
                <div className="mono text-center">
                  <p className="text-xl font-black text-white">{m.homeScore ?? 0}</p>
                  <p className="text-xl font-black text-white">{m.awayScore ?? 0}</p>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1">
                {[m.homeOdds, m.drawOdds ?? 0, m.awayOdds].filter(Boolean).map((o, i) => (
                  <div key={i} className="mono rounded bg-[var(--color-bg-3)] py-1 text-center text-[12px] font-bold text-[var(--color-brand-500)]">
                    {o.toFixed(2)}
                  </div>
                ))}
              </div>
              {selectedId === m.id && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--color-live)]">
                  <ChevronRight className="h-3 w-3" />
                  Viewing
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Match Detail */}
        {selected && (
          <div className="space-y-4">
            {/* Scoreboard */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,45,45,0.08),transparent_60%)]" />
              <div className="relative">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
                    {selected.league}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="mono flex items-center gap-1.5 rounded bg-[var(--color-live)]/10 px-2.5 py-1 text-[12px] font-bold text-[var(--color-live)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-live)] animate-pulse" />
                      {minute}&apos; — 2nd Half
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <div className="text-center flex-1">
                    <div className="mb-2 h-14 w-14 rounded-full border-2 mx-auto flex items-center justify-center text-2xl font-black" style={{ borderColor: selected.homeColor, background: `${selected.homeColor}15` }}>
                      {selected.homeShort}
                    </div>
                    <p className="text-[15px] font-bold text-white">{selected.homeTeam}</p>
                  </div>
                  <div className="text-center">
                    <p className="mono text-5xl font-black tracking-tight">
                      <span className="text-white">{selected.homeScore ?? 0}</span>
                      <span className="mx-2 text-[var(--color-ink-3)]">—</span>
                      <span className="text-white">{selected.awayScore ?? 0}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Full time score</p>
                  </div>
                  <div className="text-center flex-1">
                    <div className="mb-2 h-14 w-14 rounded-full border-2 mx-auto flex items-center justify-center text-2xl font-black" style={{ borderColor: selected.awayColor, background: `${selected.awayColor}15` }}>
                      {selected.awayShort}
                    </div>
                    <p className="text-[15px] font-bold text-white">{selected.awayTeam}</p>
                  </div>
                </div>

                {/* Recent event flash */}
                <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)]/10 py-2 text-[12px] text-[var(--color-brand-500)]">
                  <ZapIcon className="h-3.5 w-3.5" />
                  ⚽ GOAL! {selected.homeTeam} {minute - 7}&apos; — {selected.homeScore ?? 2}–{selected.awayScore ?? 1}
                </div>

                {/* Live stats */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <StatBar label="Possession" home={58} away={42} />
                  <StatBar label="Shots" home={8} away={5} />
                  <StatBar label="Corners" home={4} away={2} />
                </div>
              </div>
            </div>

            {/* Markets */}
            {suspended ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/5 py-10">
                <span className="h-3 w-3 rounded-full bg-[var(--color-warn)] animate-pulse" />
                <p className="font-bold text-[var(--color-warn)]">Markets suspended — odds re-opening shortly</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {liveMarkets.map((mkt) => (
                  <div key={mkt.type} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                      {mkt.label}
                    </p>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${mkt.selections.length}, 1fr)` }}>
                      {mkt.selections.map((sel) => (
                        <OddsButton
                          key={sel.label}
                          matchId={selected.id}
                          market={mkt.type}
                          selection={sel.label}
                          matchLabel={`${selected.homeTeam} vs ${selected.awayTeam}`}
                          odds={sel.odds}
                          isSelected={hasSelection(selected.id, mkt.type)}
                          onSelect={() =>
                            addSelection({
                              matchId: selected.id,
                              matchLabel: `${selected.homeTeam} vs ${selected.awayTeam}`,
                              market: mkt.type,
                              selection: sel.label,
                              odds: sel.odds,
                            })
                          }
                          label={sel.label}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Match Timeline */}
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                Match timeline
              </p>
              <div className="space-y-2">
                {EVENTS.slice().reverse().map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="mono w-8 shrink-0 text-right text-[var(--color-ink-3)]">{ev.min}&apos;</span>
                    <span className="text-base">
                      {ev.type === "goal" ? "⚽" : ev.type === "yellow" ? "🟨" : ev.type === "red" ? "🟥" : "⏱"}
                    </span>
                    <span className="text-[var(--color-ink-1)]">{ev.detail}</span>
                    {ev.player && <span className="text-[var(--color-ink-3)]">— {ev.player}</span>}
                  </div>
                ))}
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="mono w-8 text-right text-[var(--color-ink-3)]">0&apos;</span>
                  <span>🟢</span>
                  <span className="text-[var(--color-ink-1)]">Kick Off</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="mono font-bold text-white">{home}</span>
        <span className="text-[var(--color-ink-3)]">{label}</span>
        <span className="mono font-bold text-white">{away}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
        <div className="h-full bg-[var(--color-brand-500)]" style={{ width: `${(home / total) * 100}%` }} />
        <div className="h-full bg-[var(--color-info)]" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}
