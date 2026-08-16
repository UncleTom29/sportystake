"use client";

import { useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/mockData";
import OddsButton from "./OddsButton";
import TeamBadge from "./TeamBadge";
import { StarIcon, LiveIcon, ChevronRight, ChevronDown } from "@/components/icons/UIIcons";
import type { OddsFormat } from "./OddsButton";

type TimeMode = "local" | "utc";
export type DisplayMarketKey = "1X2" | "over_under_25" | "btts" | "double_chance";

export function getMarketHeaders(marketKey: DisplayMarketKey, hasDraw: boolean): { labels: string[]; cols: number } {
  if (marketKey === "over_under_25") return { labels: ["Over 2.5", "Under 2.5"], cols: 2 };
  if (marketKey === "btts") return { labels: ["Yes", "No"], cols: 2 };
  if (marketKey === "double_chance") return { labels: ["1X", "12", "X2"], cols: 3 };
  return hasDraw ? { labels: ["1", "X", "2"], cols: 3 } : { labels: ["1", "2"], cols: 2 };
}

function hasStarted(startsAt: string): boolean {
  const ts = Date.parse(startsAt);
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

function formatKickoff(startsAt: string, timeMode: TimeMode): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "-";

  if (timeMode === "utc") {
    return `${d.toUTCString().slice(0, 16)} UTC`;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const localTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (at.getTime() === today.getTime()) return `Today · ${localTime}`;
  if (at.getTime() === tomorrow.getTime()) return `Tomorrow · ${localTime}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${localTime}`;
}

export default function MatchRow({
  match,
  compact = false,
  isFavourite = false,
  onToggleFavourite,
  oddsFormat = "decimal",
  timeMode = "local",
  displayMarket = "1X2",
}: {
  match: Match;
  compact?: boolean;
  isFavourite?: boolean;
  onToggleFavourite?: (marketId: string) => void;
  oddsFormat?: OddsFormat;
  timeMode?: TimeMode;
  displayMarket?: DisplayMarketKey;
}) {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;
  const locked = match.isLive || hasStarted(match.startsAt);
  const oddsPending = match.markets <= 0;
  const matchDetailHref = `/sportsbook/match/${match.id}`;
  const marketsCount = match.markets > 0 ? match.markets : (match.odds?.length ? match.odds.length : 1);

  // Extract selected market odds
  const bundle = match.odds?.find((b) => b.marketType === displayMarket);

  return (
    <div className="group border-b border-[var(--color-line-1)] p-3 transition-colors last:border-b-0 hover:bg-[var(--color-bg-2)] md:grid md:grid-cols-[1fr_auto_auto] md:items-center md:gap-4 md:px-4 md:py-2.5">
      {/* Top Metadata Bar (Mobile: header line; Desktop: part of left column) */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[var(--color-ink-3)] md:mb-1.5 md:justify-start">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavourite?.(match.id);
              }}
              className={isFavourite ? "text-[var(--color-warn)] shrink-0 cursor-pointer" : "text-[var(--color-ink-4)] hover:text-[var(--color-warn)] shrink-0 cursor-pointer"}
              title={isFavourite ? "Remove from favourites" : "Save to favourites"}
            >
              <StarIcon className="h-3.5 w-3.5" />
            </button>
            {match.isLive ? (
              <span className="mono inline-flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)] shrink-0">
                <span className="h-1 w-1 rounded-full bg-[var(--color-live)] pulse-dot" />
                {match.liveMinute || "LIVE"}
              </span>
            ) : (
              <span className="mono text-[11px] text-[var(--color-ink-3)] shrink-0">
                {formatKickoff(match.startsAt, timeMode)}
              </span>
            )}
            <span className="mono rounded bg-[var(--color-bg-3)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] shrink-0">
              {match.country}
            </span>
            {oddsPending && (
              <span className="mono rounded bg-[var(--color-warn)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-warn)] shrink-0">
                Odds pending
              </span>
            )}
          </div>

          {/* Mobile Extra Markets Button — visible at top-right on mobile */}
          {!compact && (
            <Link
              href={matchDetailHref}
              className="mono flex items-center gap-1 rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-brand-400)] transition-colors hover:bg-[var(--color-bg-4)] hover:text-white md:hidden shrink-0 border border-[var(--color-line-1)]"
              title="View full match odds & markets"
            >
              +{marketsCount}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Clickable Teams Section — full width and readable */}
        <Link href={matchDetailHref} className="block py-1 hover:opacity-90 transition-opacity">
          <div className="flex flex-col gap-1.5 min-w-0">
            {/* Home Team */}
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TeamBadge initials={match.homeShort} color={match.homeColor} size="sm" />
                <span className="text-[13.5px] font-semibold text-white truncate hover:text-[var(--color-brand-400)] transition-colors">
                  {match.homeTeam}
                </span>
              </div>
              {match.isLive && (
                <span className={`mono shrink-0 text-[13.5px] font-bold ${(match.homeScore ?? 0) > (match.awayScore ?? 0) ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                  {match.homeScore ?? 0}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TeamBadge initials={match.awayShort} color={match.awayColor} size="sm" />
                <span className="text-[13.5px] font-semibold text-white truncate hover:text-[var(--color-brand-400)] transition-colors">
                  {match.awayTeam}
                </span>
              </div>
              {match.isLive && (
                <span className={`mono shrink-0 text-[13.5px] font-bold ${(match.awayScore ?? 0) > (match.homeScore ?? 0) ? "text-white" : "text-[var(--color-ink-2)]"}`}>
                  {match.awayScore ?? 0}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Dynamic Odds Column */}
      <div className="mt-3 md:mt-0">
        {displayMarket === "over_under_25" ? (
          <div className="grid grid-cols-2 gap-1.5 md:w-[184px] md:gap-2">
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Over/Under 2.5"
              selection="Over 2.5"
              label="Over 2.5"
              odds={bundle?.selections.find((s) => s.outcome === 0)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 0)!.valueX1000 / 1000 : match.totalOverOdds ?? 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Over/Under 2.5"
              selection="Under 2.5"
              label="Under 2.5"
              odds={bundle?.selections.find((s) => s.outcome === 1)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 1)!.valueX1000 / 1000 : match.totalUnderOdds ?? 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
          </div>
        ) : displayMarket === "btts" ? (
          <div className="grid grid-cols-2 gap-1.5 md:w-[184px] md:gap-2">
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Both Teams To Score"
              selection="Yes"
              label="Yes"
              odds={bundle?.selections.find((s) => s.outcome === 0)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 0)!.valueX1000 / 1000 : 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Both Teams To Score"
              selection="No"
              label="No"
              odds={bundle?.selections.find((s) => s.outcome === 1)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 1)!.valueX1000 / 1000 : 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
          </div>
        ) : displayMarket === "double_chance" ? (
          <div className="grid grid-cols-3 gap-1.5 md:w-[280px] md:gap-2">
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Double Chance"
              selection="1X"
              label="1X"
              odds={bundle?.selections.find((s) => s.outcome === 0)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 0)!.valueX1000 / 1000 : 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Double Chance"
              selection="12"
              label="12"
              odds={bundle?.selections.find((s) => s.outcome === 1)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 1)!.valueX1000 / 1000 : 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Double Chance"
              selection="X2"
              label="X2"
              odds={bundle?.selections.find((s) => s.outcome === 2)?.valueX1000 ? bundle.selections.find((s) => s.outcome === 2)!.valueX1000 / 1000 : 0}
              size="sm"
              disabled={locked}
              format={oddsFormat}
            />
          </div>
        ) : (
          /* Default 1X2 Market */
          <div
            className={`grid ${match.drawOdds ? "grid-cols-3 md:w-[280px]" : "grid-cols-2 md:w-[184px]"} gap-1.5 md:gap-2`}
          >
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market="Match Winner"
              selection={match.homeTeam}
              label="1"
              odds={match.homeOdds}
              size="sm"
              disabled={locked}
              format={oddsFormat}
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
                disabled={locked}
                format={oddsFormat}
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
              disabled={locked}
              format={oddsFormat}
            />
          </div>
        )}
      </div>

      {/* Desktop Extra Markets Count + Link */}
      {!compact && (
        <Link
          href={matchDetailHref}
          className="mono hidden h-9 items-center gap-1 rounded-md bg-[var(--color-bg-3)] px-2.5 text-[11px] font-bold text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-4)] hover:text-white md:flex border border-transparent hover:border-[var(--color-line-2)]"
          title="View all odds & markets"
        >
          +{marketsCount}
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
  isFavourite,
  onToggleFavourite,
  hasDraw = true,
  displayMarket = "1X2",
  children,
}: {
  league: string;
  country?: string;
  countryCode?: string;
  sport: string;
  liveCount?: number;
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  hasDraw?: boolean;
  displayMarket?: DisplayMarketKey;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { labels, cols } = getMarketHeaders(displayMarket, hasDraw);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 py-2 md:grid md:grid-cols-[1.5fr_auto_auto] md:gap-4 md:px-4">
        {/* Left: League Info + Collapse Toggle */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 text-left text-white hover:text-[var(--color-brand-500)] transition-colors min-w-0 cursor-pointer"
            title={isCollapsed ? "Expand league" : "Fold league"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-3)] shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--color-brand-500)] shrink-0" />
            )}
            {liveCount && liveCount > 0 ? (
              <LiveIcon className="h-3.5 w-3.5 text-[var(--color-live)] shrink-0" />
            ) : (
              <span className="mono rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] shrink-0">
                {countryCode ?? "INT"}
              </span>
            )}
            <span className="text-[13px] font-bold truncate">{league}</span>
          </button>

          {country && <span className="hidden text-[11px] text-[var(--color-ink-3)] md:inline">· {country}</span>}
          <span className="text-[11px] text-[var(--color-ink-3)] hidden sm:inline">· {sport}</span>
          {onToggleFavourite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavourite();
              }}
              className={isFavourite ? "text-[var(--color-warn)] cursor-pointer" : "text-[var(--color-ink-4)] hover:text-[var(--color-warn)] cursor-pointer"}
              title={isFavourite ? "Remove league from favourites" : "Save league to favourites"}
            >
              <StarIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Center: Market outcome headers aligned directly with odds grid below on desktop */}
        <div
          className={`hidden md:grid ${
            cols === 3 ? "grid-cols-3 md:w-[280px]" : "grid-cols-2 md:w-[184px]"
          } gap-1.5 md:gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-4)] text-center`}
        >
          {labels.map((l, i) => (
            <span key={i} className="truncate">
              {l}
            </span>
          ))}
        </div>

        {/* Right: Spacer to match MatchRow's extra markets column */}
        <div className="hidden md:block w-[64px]" />
      </div>

      {!isCollapsed && <div>{children}</div>}
    </div>
  );
}
