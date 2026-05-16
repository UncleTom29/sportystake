"use client";
import Link from "next/link";
import type { Match } from "@/lib/mockData";
import OddsButton from "./OddsButton";
import TeamBadge from "./TeamBadge";
import { SportIcon } from "@/components/icons/SportIcons";
import { LiveIcon, FlameIcon, ChevronRight } from "@/components/icons/UIIcons";

export default function MatchCard({ match }: { match: Match }) {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 transition-colors hover:border-[var(--color-line-2)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SportIcon sport={match.sportSlug} className="h-3.5 w-3.5 text-[var(--color-ink-3)]" />
          <span className="text-[11px] font-semibold text-[var(--color-ink-2)]">{match.league}</span>
          <span className="mono rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
            {match.country}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {match.isHot && (
            <span className="inline-flex items-center gap-1 rounded bg-[var(--color-warn)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-warn)]">
              <FlameIcon className="h-3 w-3" />
              HOT
            </span>
          )}
          {match.isLive ? (
            <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
              <LiveIcon className="h-3 w-3 pulse-dot" />
              {match.liveMinute}
            </span>
          ) : (
            <span className="mono text-[11px] text-[var(--color-ink-3)]">{match.time}</span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="mb-3 space-y-2">
        <Team team={match.homeTeam} short={match.homeShort} color={match.homeColor} score={match.homeScore} isLive={match.isLive} />
        <Team team={match.awayTeam} short={match.awayShort} color={match.awayColor} score={match.awayScore} isLive={match.isLive} />
      </div>

      {/* Odds row */}
      <div className={`grid ${match.drawOdds ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.homeTeam}
          label={match.drawOdds ? "1" : match.homeShort}
          odds={match.homeOdds}
        />
        {match.drawOdds && (
          <OddsButton
            matchId={match.id}
            matchLabel={label}
            market="Match Winner"
            selection="Draw"
            label="X"
            odds={match.drawOdds}
          />
        )}
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.awayTeam}
          label={match.drawOdds ? "2" : match.awayShort}
          odds={match.awayOdds}
        />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-[var(--color-ink-3)]">+{match.markets} more markets</span>
        <Link
          href={`/sportsbook?match=${match.id}`}
          className="flex items-center gap-0.5 font-semibold text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
        >
          View
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Team({
  team,
  short,
  color,
  score,
  isLive,
}: {
  team: string;
  short: string;
  color: string;
  score?: number;
  isLive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge initials={short} color={color} size="sm" />
      <span className="flex-1 truncate text-[13px] font-semibold text-white">{team}</span>
      {isLive && (
        <span className="mono text-[14px] font-bold text-white">{score}</span>
      )}
    </div>
  );
}
