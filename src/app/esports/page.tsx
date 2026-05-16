"use client";
import { useState } from "react";
import { esportsMatches } from "@/lib/mockData";
import OddsButton from "@/components/sportsbook/OddsButton";
import TeamBadge from "@/components/sportsbook/TeamBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import { teamInitials } from "@/lib/format";
import { EsportsIcon } from "@/components/icons/SportIcons";
import { LiveIcon, TrophyIcon, FlameIcon } from "@/components/icons/UIIcons";

const games = ["All", "CS2", "Valorant", "Dota 2", "LoL", "FIFA", "CoD"];

export default function EsportsPage() {
  const [g, setG] = useState("All");
  const filtered = esportsMatches.filter((m) => g === "All" || m.game === g);
  const liveMatches = filtered.filter((m) => m.isLive);
  const upcoming = filtered.filter((m) => !m.isLive);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative flex items-center gap-4 p-6 md:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-bg-3)] text-[var(--color-info)]">
            <EsportsIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Esports</h1>
            <p className="text-[13px] text-[var(--color-ink-2)]">CS2 · Valorant · Dota 2 · LoL · live odds, in-play, map markets</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-1.5 overflow-x-auto scrollbar-none">
        {games.map((name) => (
          <button
            key={name}
            onClick={() => setG(name)}
            className={`flex h-9 shrink-0 items-center rounded-md px-3 text-[12px] font-semibold transition-colors ${
              g === name
                ? "bg-[var(--color-info)] text-[var(--color-bg-0)]"
                : "bg-[var(--color-bg-2)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {liveMatches.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Live" Icon={LiveIcon} accent="var(--color-live)" />
          <div className="grid gap-3 md:grid-cols-2">
            {liveMatches.map((m) => <EsportsMatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionHeader title="Upcoming" Icon={TrophyIcon} accent="var(--color-info)" />
        <div className="grid gap-3 md:grid-cols-2">
          {upcoming.map((m) => <EsportsMatchCard key={m.id} match={m} />)}
        </div>
      </section>
    </div>
  );
}

function EsportsMatchCard({ match }: { match: typeof esportsMatches[number] }) {
  const label = `${match.team1} vs ${match.team2}`;
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-bg-3)] text-[var(--color-info)]">
            <EsportsIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--color-ink-2)]">{match.tournament}</span>
        </div>
        {match.isLive ? (
          <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
            <LiveIcon className="h-3 w-3 pulse-dot" />
            {match.time}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="mono text-[11px] text-[var(--color-ink-3)]">{match.time}</span>
            <FlameIcon className="h-3 w-3 text-[var(--color-warn)]" />
          </div>
        )}
      </div>
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <TeamBadge initials={teamInitials(match.team1Short)} color={match.team1Color} size="sm" />
          <span className="flex-1 truncate text-[13px] font-semibold text-white">{match.team1}</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamBadge initials={teamInitials(match.team2Short)} color={match.team2Color} size="sm" />
          <span className="flex-1 truncate text-[13px] font-semibold text-white">{match.team2}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <OddsButton matchId={match.id} matchLabel={label} market="Match Winner" selection={match.team1} label={match.team1Short} odds={match.team1Odds} />
        <OddsButton matchId={match.id} matchLabel={label} market="Match Winner" selection={match.team2} label={match.team2Short} odds={match.team2Odds} />
      </div>
    </div>
  );
}
