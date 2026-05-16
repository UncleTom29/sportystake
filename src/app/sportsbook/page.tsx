"use client";
import { useMemo, useState } from "react";
import { matches, sportsList } from "@/lib/mockData";
import Sidebar from "@/components/layout/Sidebar";
import MatchRow, { LeagueGroup } from "@/components/sportsbook/MatchRow";
import { SportIcon } from "@/components/icons/SportIcons";
import { LiveIcon, FlameIcon, TrophyIcon, ChevronDown } from "@/components/icons/UIIcons";

type Tab = "all" | "live" | "today" | "tomorrow" | "outright";

const tabs: { id: Tab; label: string; Icon?: (p: { className?: string }) => React.ReactElement }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live", Icon: LiveIcon },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "outright", label: "Outrights" },
];

export default function SportsbookPage() {
  const [sport, setSport] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("all");

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (sport !== "all" && m.sportSlug !== sport) return false;
      if (tab === "live") return m.isLive;
      if (tab === "today") return m.time.includes("Today") || m.isLive;
      if (tab === "tomorrow") return m.time.includes("Tomorrow");
      return true;
    });
  }, [sport, tab]);

  // Group by league
  const grouped = useMemo(() => {
    const map = new Map<string, typeof matches>();
    for (const m of filtered) {
      const key = m.league;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const liveCount = matches.filter((m) => m.isLive).length;

  return (
    <div className="mx-auto flex max-w-[1400px] gap-5 px-3 py-4 md:px-5">
      <Sidebar activeSport={sport === "all" ? undefined : sport} onSportChange={setSport} />

      <div className="min-w-0 flex-1">
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-bg-2)] text-[var(--color-brand-500)]">
              <SportIcon sport={(sport === "all" ? "soccer" : sport) as Parameters<typeof SportIcon>[0]["sport"]} className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-white">
                {sport === "all" ? "All sports" : sportsList.find((s) => s.slug === sport)?.name}
              </h1>
              <p className="text-[12px] text-[var(--color-ink-3)]">
                {filtered.length} matches · {liveCount} live · 12,400+ markets total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="mono flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]">
              Decimal
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]">
              Time
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Sport pills */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          <SportPill active={sport === "all"} onClick={() => setSport("all")} label="All" count={matches.length} />
          {sportsList.map((s) => (
            <SportPill
              key={s.slug}
              active={sport === s.slug}
              onClick={() => setSport(s.slug)}
              label={s.name}
              count={matches.filter((m) => m.sportSlug === s.slug).length}
              Icon={() => <SportIcon sport={s.slug} />}
            />
          ))}
        </div>

        {/* Time tabs */}
        <div className="mb-4 flex items-center gap-1 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex h-8 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-bg-3)] text-white"
                    : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
                }`}
              >
                {t.Icon && <t.Icon className={`h-3.5 w-3.5 ${t.id === "live" ? "text-[var(--color-live)]" : ""}`} />}
                {t.label}
                {t.id === "live" && liveCount > 0 && (
                  <span className="mono ml-0.5 rounded bg-[var(--color-live)]/15 px-1 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto hidden items-center gap-2 px-2 text-[11px] text-[var(--color-ink-3)] md:flex">
            <FlameIcon className="h-3 w-3 text-[var(--color-warn)]" />
            Top boost: +12%
          </div>
        </div>

        {/* Groups */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] py-20 text-center">
            <TrophyIcon className="h-8 w-8 text-[var(--color-ink-4)]" />
            <p className="text-[13px] text-[var(--color-ink-2)]">No matches in this view</p>
            <p className="text-[11px] text-[var(--color-ink-3)]">Try a different sport or time filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([league, ms]) => {
              const first = ms[0];
              const live = ms.filter((m) => m.isLive).length;
              return (
                <LeagueGroup
                  key={league}
                  league={league}
                  countryCode={first.country}
                  sport={first.sport}
                  liveCount={live}
                >
                  {ms.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </LeagueGroup>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SportPill({
  active,
  onClick,
  label,
  count,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  Icon?: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${
        active
          ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
          : "bg-[var(--color-bg-2)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <span className={`mono text-[10px] ${active ? "text-[var(--color-bg-0)]/70" : "text-[var(--color-ink-3)]"}`}>{count}</span>
    </button>
  );
}
