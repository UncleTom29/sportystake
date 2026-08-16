"use client";
import { useEffect, useState } from "react";
import { Markets } from "@/lib/api-client";
import type { MarketDTO } from "@/lib/types";

const POLL_MS = 15_000;

const MAJOR_SPORTS_ORDER = [
  "football",
  "basketball",
  "tennis",
  "american-football",
  "baseball",
  "ice-hockey",
  "mma",
  "boxing",
  "esports",
  "volleyball",
  "table-tennis",
  "rugby",
  "cricket",
];

function getSportPriority(slug: string): number {
  let norm = slug.toLowerCase();
  if (norm === "martial-arts") norm = "mma";
  const idx = MAJOR_SPORTS_ORDER.indexOf(norm);
  return idx !== -1 ? idx : 99;
}

const LEAGUE_PRIORITY: { pattern: RegExp; tier: number }[] = [
  { pattern: /^(?:uefa\s+)?champions league$/i, tier: 1 },
  { pattern: /^(?:uefa\s+)?europa league$/i, tier: 2 },
  { pattern: /^(?:uefa\s+)?(?:europa )?conference league$/i, tier: 3 },
  { pattern: /nba/i, tier: 4 },
  { pattern: /nfl/i, tier: 5 },
  { pattern: /mlb/i, tier: 6 },
  { pattern: /nhl/i, tier: 7 },
  { pattern: /^premier league$/i, tier: 10 },
  { pattern: /^la liga$/i, tier: 11 },
  { pattern: /^bundesliga$/i, tier: 12 },
  { pattern: /^serie a$/i, tier: 13 },
  { pattern: /^ligue 1/i, tier: 14 },
  { pattern: /primeira liga|liga nos/i, tier: 20 },
  { pattern: /eredivisie/i, tier: 21 },
  { pattern: /pro league|jupiler/i, tier: 22 },
  { pattern: /scottish.*premiership|premiership.*scotland/i, tier: 23 },
  { pattern: /s[üu]per lig/i, tier: 24 },
  { pattern: /^mls$|major league soccer/i, tier: 30 },
  { pattern: /brasileir[aã]o/i, tier: 31 },
  { pattern: /liga profesional|primera.*arg/i, tier: 32 },
  { pattern: /liga mx/i, tier: 33 },
  { pattern: /euroleague/i, tier: 34 },
  { pattern: /atp|wta|wimbledon|us open|french open|australian open/i, tier: 35 },
];

function getLeaguePriority(name: string): number {
  for (const entry of LEAGUE_PRIORITY) {
    if (entry.pattern.test(name)) return entry.tier;
  }
  return 999;
}

import LiveMatchModal, { type LiveEventDetails } from "@/components/sportsbook/LiveMatchModal";

export default function LiveScoreTicker() {
  const [live, setLive] = useState<MarketDTO[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LiveEventDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await Markets.live();
        if (!cancelled) {
          const majorLive = res.items
            .filter((m) => getSportPriority(m.sport) !== 99)
            .sort((a, b) => {
              const pa = getSportPriority(a.sport);
              const pb = getSportPriority(b.sport);
              if (pa !== pb) return pa - pb;

              const la = getLeaguePriority(a.leagueName);
              const lb = getLeaguePriority(b.leagueName);
              if (la !== lb) return la - lb;

              return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });

          setLive(majorLive);
        }
      } catch {
        // Swallow — the ticker degrades to empty rather than blowing up.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (live.length === 0) return null;

  const items = live.map((m) => ({
    market: m,
    label: `🔴 ${m.homeTeam} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeam}${m.liveMinute ? ` ${m.liveMinute}'` : ""}`,
    league: m.leagueName,
  }));
  const doubled = [...items, ...items];

  const handleSelect = (m: MarketDTO) => {
    setSelectedEvent({
      match_id: m.id,
      match: `${m.homeTeam} vs ${m.awayTeam}`,
      sport: m.sport,
      league: m.leagueName,
      country: m.country,
      match_time: m.startTime,
      score: { home: m.homeScore ?? 0, away: m.awayScore ?? 0 },
      period: m.liveMinute ? `${m.liveMinute}'` : "LIVE",
      minute: m.liveMinute ?? null,
      finished: m.status === "SETTLED" || m.status === "CANCELLED",
    });
  };

  return (
    <>
      <div className="relative h-8 overflow-hidden border-b border-[var(--color-line-1)] bg-[var(--color-live)]/5">
        <div className="absolute inset-y-0 left-0 z-10 flex items-center bg-[var(--color-live)] px-3">
          <span className="mono text-[10px] font-black uppercase tracking-wider text-white">Live</span>
        </div>
        <div className="absolute inset-y-0 left-16 right-0 overflow-hidden">
          <div
            className="flex h-full items-center gap-8 whitespace-nowrap text-[12px] text-[var(--color-ink-1)]"
            style={{ animation: "ticker 35s linear infinite" }}
          >
            {doubled.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(item.market)}
                className="flex items-center gap-2 cursor-pointer hover:underline text-left"
              >
                <span className="font-semibold text-white">{item.label}</span>
                <span className="text-[var(--color-ink-3)]">· {item.league}</span>
              </button>
            ))}
          </div>
        </div>
        <style jsx>{`
          @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {selectedEvent && (
        <LiveMatchModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
