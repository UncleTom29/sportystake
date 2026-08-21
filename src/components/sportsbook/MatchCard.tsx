"use client";

import Link from "next/link";
import type { Match } from "@/lib/mockData";
import OddsButton from "./OddsButton";
import TeamBadge from "./TeamBadge";
import { SportIcon } from "@/components/icons/SportIcons";
import { LiveIcon, FlameIcon, ChevronRight } from "@/components/icons/UIIcons";

export default function MatchCard({ match }: { match: Match }) {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;
  const started = match.isLive || (Number.isFinite(Date.parse(match.startsAt)) && Date.parse(match.startsAt) <= Date.now()) || match.status === "SETTLED" || match.status === "CANCELLED" || match.status === "FINISHED";
  const oddsPending = match.markets <= 0;
  const matchDetailHref = `/sportsbook/match/${match.id}`;
  const marketsCount = match.markets > 0 ? match.markets : (match.odds?.length ? match.odds.length : 1);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 transition-colors hover:border-[var(--color-line-2)]">
      {/* Clickable Header & Teams Section */}
      <Link href={matchDetailHref} className="block group-hover:opacity-95 transition-opacity">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <SportIcon sport={match.sportSlug} className="h-3.5 w-3.5 text-[var(--color-ink-3)] shrink-0" />
            <span className="text-[11px] font-semibold text-[var(--color-ink-2)] truncate">{match.league}</span>
            <span className="mono rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] shrink-0">
              {match.country}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {match.isHot && (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--color-warn)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-warn)]">
                <FlameIcon className="h-3 w-3" />
                HOT
              </span>
            )}
            {match.isLive ? (
              <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                <LiveIcon className="h-3 w-3 pulse-dot" />
                {match.liveMinute || "LIVE"}
              </span>
            ) : (
              <span className="mono text-[11px] text-[var(--color-ink-3)]">{match.time}</span>
            )}
            {oddsPending && (
              <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-warn)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-warn)]">
                Odds pending
              </span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="mb-3 space-y-2">
          <Team team={match.homeTeam} short={match.homeShort} color={match.homeColor} score={match.homeScore} isLive={match.isLive} />
          <Team team={match.awayTeam} short={match.awayShort} color={match.awayColor} score={match.awayScore} isLive={match.isLive} />
        </div>
      </Link>

      {/* Odds row */}
      <div className={`grid ${match.drawOdds ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.homeTeam}
          label={match.drawOdds ? "1" : match.homeShort}
          odds={match.homeOdds}
          disabled={started}
          size="sm"
        />
        {match.drawOdds && (
          <OddsButton
            matchId={match.id}
            matchLabel={label}
            market="Match Winner"
            selection="Draw"
            label="X"
            odds={match.drawOdds}
            disabled={started}
            size="sm"
          />
        )}
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.awayTeam}
          label={match.drawOdds ? "2" : match.awayShort}
          odds={match.awayOdds}
          disabled={started}
          size="sm"
        />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px] border-t border-[var(--color-line-1)] pt-2.5">
        <Link href={matchDetailHref} className="text-[var(--color-ink-3)] hover:text-white font-medium">
          +{marketsCount} odds available
        </Link>
        <Link
          href={matchDetailHref}
          className="flex items-center gap-0.5 font-semibold text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)] transition-colors"
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
    <div className="flex items-center justify-between gap-2.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <TeamBadge initials={short} color={color} size="sm" />
        <span className="truncate text-[13.5px] font-semibold text-white group-hover:text-[var(--color-brand-400)] transition-colors">
          {team}
        </span>
      </div>
      {isLive && (
        <span className="mono text-[14px] font-bold text-white shrink-0 ml-2">
          {score ?? 0}
        </span>
      )}
    </div>
  );
}
