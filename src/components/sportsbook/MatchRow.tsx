"use client";
import Link from "next/link";
import type { Match } from "@/lib/mockData";
import OddsButton from "./OddsButton";
import TeamBadge from "./TeamBadge";
import { StarIcon, LiveIcon, ChevronRight } from "@/components/icons/UIIcons";

export default function MatchRow({ match, compact = false }: { match: Match; compact?: boolean }) {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;

  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--color-line-1)] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--color-bg-2)] md:grid-cols-[1.5fr_auto_auto] md:gap-4 md:px-4">
      {/* Match info */}
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] text-[var(--color-ink-3)]">
          <button className="text-[var(--color-ink-4)] hover:text-[var(--color-warn)]">
            <StarIcon className="h-3.5 w-3.5" />
          </button>
          {match.isLive ? (
            <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
              <span className="h-1 w-1 rounded-full bg-[var(--color-live)] pulse-dot" />
              {match.liveMinute}
            </span>
          ) : (
            <span className="mono text-[11px] text-[var(--color-ink-3)]">{match.time}</span>
          )}
          <span className="mono rounded bg-[var(--color-bg-3)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
            {match.country}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <TeamBadge initials={match.homeShort} color={match.homeColor} size="sm" />
            <TeamBadge initials={match.awayShort} color={match.awayColor} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-white">{match.homeTeam}</p>
              {match.isLive && (
                <span className={`mono shrink-0 text-[13px] font-bold ${(match.homeScore ?? 0) > (match.awayScore ?? 0) ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                  {match.homeScore}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-white">{match.awayTeam}</p>
              {match.isLive && (
                <span className={`mono shrink-0 text-[13px] font-bold ${(match.awayScore ?? 0) > (match.homeScore ?? 0) ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                  {match.awayScore}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Odds (1X2) */}
      <div className={`grid ${match.drawOdds ? "grid-cols-3" : "grid-cols-2"} gap-1.5 md:gap-2`}>
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.homeTeam}
          label="1"
          odds={match.homeOdds}
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
            size="sm"
          />
        )}
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.awayTeam}
          label="2"
          odds={match.awayOdds}
          size="sm"
        />
      </div>

      {/* Extra markets count + live indicator */}
      {!compact && (
        <Link
          href={`/sportsbook?match=${match.id}`}
          className="mono hidden h-9 items-center gap-1 rounded-md bg-[var(--color-bg-3)] px-2.5 text-[11px] font-bold text-[var(--color-ink-2)] hover:bg-[var(--color-bg-4)] hover:text-white md:flex"
        >
          +{match.markets}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function LeagueGroup({
  league,
  country,
  countryCode,
  sport,
  liveCount,
  children,
}: {
  league: string;
  country?: string;
  countryCode?: string;
  sport: string;
  liveCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 py-2 md:px-4">
        <div className="flex items-center gap-2">
          {liveCount && liveCount > 0 ? (
            <LiveIcon className="h-3.5 w-3.5 text-[var(--color-live)]" />
          ) : (
            <span className="mono rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
              {countryCode ?? "INT"}
            </span>
          )}
          <span className="text-[12px] font-bold text-white">{league}</span>
          {country && <span className="hidden text-[11px] text-[var(--color-ink-3)] md:inline">· {country}</span>}
          <span className="text-[11px] text-[var(--color-ink-3)]">· {sport}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-4)] md:flex">
            <span className="w-[88px] text-center">1</span>
            <span className="w-[88px] text-center">X</span>
            <span className="w-[88px] text-center">2</span>
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
