"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LiveIcon, ChevronDown, ChevronRight } from "@/components/icons/UIIcons";
import LiveMatchModal from "@/components/sportsbook/LiveMatchModal";

interface LiveEvent {
  match_id: string;
  match: string;
  sport: string;
  league: string;
  country: string;
  match_time: string;
  score: { home: number; away: number };
  period: string | null;
  minute: number | null;
  finished: boolean;
}

interface LeagueGroup {
  league: string;
  country: string;
  events: LiveEvent[];
}
interface SportGroup {
  sport: string;
  label: string;
  count: number;
  leagues: LeagueGroup[];
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "table-tennis": "Table Tennis",
  volleyball: "Volleyball",
  baseball: "Baseball",
  handball: "Handball",
  cricket: "Cricket",
  rugby: "Rugby",
  boxing: "Boxing",
  "martial-arts": "MMA",
  "ice-hockey": "Ice Hockey",
  darts: "Darts",
  snooker: "Snooker",
  badminton: "Badminton",
  golf: "Golf",
  esports: "Esports",
  futsal: "Futsal",
  "beach-volleyball": "Beach Volleyball",
  "american-football": "Am. Football",
  "gaelic-football": "Gaelic Football",
  "australian-rules": "Aus. Rules",
};

function sportLabel(slug: string): string {
  return SPORT_LABELS[slug] ?? slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Consolidate esports-* and fifa under "esports".
function normaliseSportTab(sport: string): string {
  if (sport.startsWith("esports") || sport === "fifa" || sport === "cybersport") return "esports";
  return sport;
}

function matchStatus(ev: LiveEvent): string {
  if (ev.finished) return "FT";
  if (ev.minute !== null && ev.minute > 0 && ev.minute <= 300) return `${ev.minute}'`;
  const p = (ev.period ?? "").toLowerCase();
  if (p.includes("half-time") || p.includes("half time") || p === "ht") return "HT";
  if (p.includes("ot") || p.includes("overtime") || p.includes("extra time")) return "ET";
  if (p.includes("penalty") || p === "pen") return "PEN";
  const qm = p.match(/q(?:uarter)?\s*(\d)/i);
  if (qm) return `Q${qm[1]}`;
  const pm = p.match(/p(?:eriod)?\s*(\d)/i);
  if (pm) return `P${pm[1]}`;
  const setm = p.match(/(\d+)(?:st|nd|rd|th)?\s*set/i);
  if (setm) return `S${setm[1]}`;
  const halfm = p.match(/(\d+)(?:st|nd|rd|th)?\s*half/i);
  if (halfm) return halfm[1] === "1" ? "1H" : `${halfm[1]}H`;
  const inningm = p.match(/(\d+)(?:st|nd|rd|th)?\s*inning/i);
  if (inningm) return `I${inningm[1]}`;
  // If period string is short enough, show it directly (e.g. "1H", "2H", "OT").
  if (p.length <= 4 && p.trim()) return p.toUpperCase().trim();
  return "LIVE";
}

function statusColor(status: string): string {
  if (status === "FT") return "text-[var(--color-ink-3)]";
  if (status === "HT") return "text-[var(--color-warn)]";
  return "text-[var(--color-live)]";
}

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
  // Top UEFA / Global club competitions
  { pattern: /^(?:uefa\s+)?champions league$/i, tier: 1 },
  { pattern: /^(?:uefa\s+)?europa league$/i, tier: 2 },
  { pattern: /^(?:uefa\s+)?(?:europa )?conference league$/i, tier: 3 },
  { pattern: /nba/i, tier: 4 },
  { pattern: /nfl/i, tier: 5 },
  { pattern: /mlb/i, tier: 6 },
  { pattern: /nhl/i, tier: 7 },

  // Top-5 European Soccer
  { pattern: /^premier league$/i, tier: 10 },
  { pattern: /^la liga$/i, tier: 11 },
  { pattern: /^bundesliga$/i, tier: 12 },
  { pattern: /^serie a$/i, tier: 13 },
  { pattern: /^ligue 1/i, tier: 14 },

  // Other major European / Global Soccer
  { pattern: /primeira liga|liga nos/i, tier: 20 },
  { pattern: /eredivisie/i, tier: 21 },
  { pattern: /pro league|jupiler/i, tier: 22 },
  { pattern: /scottish.*premiership|premiership.*scotland/i, tier: 23 },
  { pattern: /s[üu]per lig/i, tier: 24 },

  // US & Latin American Soccer / Major Tennis & Basketball
  { pattern: /^mls$|major league soccer/i, tier: 30 },
  { pattern: /brasileir[aã]o/i, tier: 31 },
  { pattern: /liga profesional|primera.*arg/i, tier: 32 },
  { pattern: /liga mx/i, tier: 33 },
  { pattern: /euroleague/i, tier: 34 },
  { pattern: /atp|wta|wimbledon|us open|french open|australian open/i, tier: 35 },

  // Second divisions
  { pattern: /^championship$/i, tier: 40 },
  { pattern: /la liga 2|segunda/i, tier: 41 },
  { pattern: /2\. bundesliga/i, tier: 42 },
  { pattern: /^serie b$/i, tier: 43 },
  { pattern: /^ligue 2/i, tier: 44 },
];

function getLeaguePriority(name: string): number {
  for (const entry of LEAGUE_PRIORITY) {
    if (entry.pattern.test(name)) return entry.tier;
  }
  return 999;
}

function groupEvents(events: LiveEvent[]): SportGroup[] {
  const bySport = new Map<string, Map<string, LiveEvent[]>>();

  for (const ev of events) {
    const sport = normaliseSportTab(ev.sport);
    if (!bySport.has(sport)) bySport.set(sport, new Map());
    const byLeague = bySport.get(sport)!;
    const league = ev.league || "Other";
    if (!byLeague.has(league)) byLeague.set(league, []);
    byLeague.get(league)!.push(ev);
  }

  const groups: SportGroup[] = [];
  for (const [sport, byLeague] of bySport) {
    const leagues: LeagueGroup[] = [];
    for (const [league, evs] of byLeague) {
      leagues.push({ league, country: evs[0].country ?? "", events: evs });
    }
    leagues.sort((a, b) => {
      const pa = getLeaguePriority(a.league);
      const pb = getLeaguePriority(b.league);
      if (pa !== pb) return pa - pb;
      return b.events.length - a.events.length;
    });
    groups.push({ sport, label: sportLabel(sport), count: [...byLeague.values()].flat().length, leagues });
  }
  groups.sort((a, b) => {
    const pa = getSportPriority(a.sport);
    const pb = getSportPriority(b.sport);
    if (pa !== pb) return pa - pb;
    return b.count - a.count;
  });
  return groups;
}

function FoldableLeagueCard({ lg, onSelectEvent }: { lg: LeagueGroup; onSelectEvent?: (ev: LiveEvent) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
      {/* League header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-2)] cursor-pointer"
      >
        <span className="text-[var(--color-ink-3)]">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        {lg.country && (
          <span className="text-[10px] text-[var(--color-ink-3)]">{lg.country} ·</span>
        )}
        <span className="text-[11px] font-semibold text-[var(--color-ink-2)]">{lg.league}</span>
        <span className="ml-auto mono text-[10px] text-[var(--color-ink-3)]">{lg.events.length}</span>
      </button>

      {/* Match rows */}
      {open && (
        <div className="divide-y divide-[var(--color-line-1)]">
          {lg.events.map((ev) => {
            const status = matchStatus(ev);
            const isFt = ev.finished;
            const { home, away } = ev.score;
            const [homeName, awayName] = ev.match.includes(" vs ")
              ? ev.match.split(" vs ")
              : [ev.match, ""];

            return (
              <div
                key={ev.match_id}
                onClick={() => onSelectEvent?.(ev)}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] transition-colors cursor-pointer ${
                  isFt ? "opacity-60" : "hover:bg-[var(--color-bg-3)]/50"
                }`}
              >
                {/* Status / minute */}
                <div className={`mono w-10 shrink-0 text-right text-[11px] font-bold ${statusColor(status)}`}>
                  {status}
                </div>

                {/* Teams + score */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${home > away && !isFt ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                      {homeName?.trim()}
                    </p>
                    <p className={`truncate font-semibold ${away > home && !isFt ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                      {awayName?.trim()}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="mono shrink-0 text-right">
                    <p className={`text-[15px] font-black ${home > away && !isFt ? "text-white" : isFt ? "text-[var(--color-ink-2)]" : "text-white"}`}>
                      {home}
                    </p>
                    <p className={`text-[15px] font-black ${away > home && !isFt ? "text-white" : isFt ? "text-[var(--color-ink-2)]" : "text-white"}`}>
                      {away}
                    </p>
                  </div>
                </div>

                {/* Period label */}
                {ev.period && !isFt && (
                  <div className="shrink-0 hidden sm:block text-[10px] text-[var(--color-ink-3)] max-w-[80px] truncate text-right">
                    {ev.period}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<string>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchScores() {
    try {
      const res = await fetch("/api/livescores", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { events: LiveEvent[]; total: number; lastUpdated: string | null };
      setEvents(data.events);
      setLastUpdated(new Date());
    } catch {
      // Non-fatal — keep stale data.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchScores();
    intervalRef.current = setInterval(() => void fetchScores(), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const groups = groupEvents(events);
  const tabGroups = tab === "all" ? groups : groups.filter((g) => g.sport === tab);
  const totalLive = events.filter((e) => !e.finished).length;
  const totalFt = events.filter((e) => e.finished).length;

  // Collect unique sport tabs from current events.
  const sportTabs = [{ sport: "all", label: "All", count: events.length }, ...groups.map((g) => ({ sport: g.sport, label: g.label, count: g.count }))];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-live)]/10 text-[var(--color-live)]">
            <LiveIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[20px] font-black tracking-tight">LIVE SCORES</h1>
            <p className="text-[12px] text-[var(--color-ink-3)]">
              {loading ? "Loading…" : (
                <>
                  <span className="mono font-bold text-[var(--color-live)]">{totalLive}</span>
                  {" in play"}
                  {totalFt > 0 && <> · <span className="mono font-bold text-[var(--color-ink-3)]">{totalFt}</span> finished</>}
                </>
              )}
            </p>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-[10px] text-[var(--color-ink-3)]">
            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </div>

      {/* Sport tabs */}
      {sportTabs.length > 1 && (
        <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {sportTabs.map((t) => (
            <button
              key={t.sport}
              onClick={() => setTab(t.sport)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                tab === t.sport
                  ? "bg-[var(--color-live)]/15 text-[var(--color-live)] border border-[var(--color-live)]/30"
                  : "bg-[var(--color-bg-2)] border border-[var(--color-line-1)] text-[var(--color-ink-2)] hover:text-white"
              }`}
            >
              {t.label}
              <span className={`mono rounded px-1 text-[10px] ${tab === t.sport ? "text-[var(--color-live)]" : "text-[var(--color-ink-3)]"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <LiveIcon className="h-10 w-10 text-[var(--color-ink-3)] animate-pulse" />
          <p className="text-[15px] font-bold text-white">No matches in play right now</p>
          <p className="text-[12px] text-[var(--color-ink-3)]">Live scores update every 30 seconds.</p>
          <Link href="/sportsbook" className="mt-2 text-[12px] text-[var(--color-brand-500)] hover:underline">
            Browse upcoming matches →
          </Link>
        </div>
      )}

      {/* Event groups */}
      <div className="space-y-5">
        {tabGroups.map((group) => (
          <div key={group.sport}>
            {/* Sport header */}
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-2)]">
                {group.label}
              </span>
              <span className="mono rounded bg-[var(--color-bg-2)] border border-[var(--color-line-1)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-3)]">
                {group.count}
              </span>
              <div className="h-px flex-1 bg-[var(--color-line-1)]" />
            </div>

            {/* Leagues */}
            <div className="space-y-2">
              {group.leagues.map((lg) => (
                <FoldableLeagueCard key={lg.league} lg={lg} onSelectEvent={(ev) => setSelectedEvent(ev)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {!loading && events.length > 0 && (
        <p className="mt-6 text-center text-[10px] text-[var(--color-ink-3)]">
          Source: 1xbet LiveFeed · Scores refresh automatically every 30 s
        </p>
      )}

      {selectedEvent && (
        <LiveMatchModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
