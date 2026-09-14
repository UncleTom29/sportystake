"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloseIcon, LiveIcon, ArrowUpRight } from "@/components/icons/UIIcons";
import { SportIcon } from "@/components/icons/SportIcons";
import { Markets } from "@/lib/api-client";
import type { MarketDTO } from "@/lib/types";
import OddsButton from "@/components/sportsbook/OddsButton";
import LiveMatchCenter from "@/components/sportsbook/LiveMatchCenter";

export interface LiveEventDetails {
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

interface Props {
  event: LiveEventDetails | null;
  onClose: () => void;
}

const SPORT_NAMES: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "table-tennis": "Table Tennis",
  volleyball: "Volleyball",
  baseball: "Baseball",
  cricket: "Cricket",
  rugby: "Rugby",
  boxing: "Boxing",
  mma: "MMA",
  "ice-hockey": "Ice Hockey",
  esports: "Esports",
  "american-football": "Am. Football",
};

export default function LiveMatchModal({ event, onClose }: Props) {
  const [market, setMarket] = useState<MarketDTO | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    setLoadingMarket(true);
    setMarket(null);

    // Try fetching market details by match_id
    Markets.detail(event.match_id)
      .then((m) => {
        if (!cancelled) setMarket(m);
      })
      .catch(() => {
        if (!cancelled) setMarket(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMarket(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event]);

  if (!event) return null;

  const [homeName, awayName] = event.match.includes(" vs ")
    ? event.match.split(" vs ")
    : [event.match, "Away Team"];

  const sportSlug = (event.sport || "football").toLowerCase();
  const sportLabel = SPORT_NAMES[sportSlug] ?? event.sport;

  const isFinished = event.finished;
  const minuteText =
    event.minute !== null && event.minute > 0 && event.minute <= 300
      ? `${event.minute}'`
      : event.period || "LIVE";
  // Period and minute are two different facts (which stage, how far into
  // it) worth showing together when both exist, not two separate rows
  // each showing half of the same picture.
  const statusLine = [
    event.period,
    event.minute !== null && event.minute > 0 && event.minute <= 300 ? `${event.minute}'` : null,
  ].filter(Boolean).join(" · ") || (isFinished ? "Finished" : "In Play");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)]/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <SportIcon sport={sportSlug as any} className="h-4 w-4 text-[var(--color-ink-3)]" />
            <span className="text-[12px] font-bold text-[var(--color-ink-2)] uppercase tracking-wider">
              {event.country ? `${event.country} · ` : ""}{event.league || sportLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-3)] text-[var(--color-ink-3)] transition-colors hover:text-white cursor-pointer"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Live Score Hero Banner (Livescores.com style) */}
        <div className="relative bg-[var(--color-bg-2)] px-6 py-8 text-center">
          {/* Status Badge */}
          <div className="mb-4 flex items-center justify-center gap-2">
            {isFinished ? (
              <span className="rounded-full bg-[var(--color-bg-3)] px-3 py-1 text-[11px] font-bold text-[var(--color-ink-3)]">
                FULL TIME (FT)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-live)]/30 bg-[var(--color-live)]/10 px-3 py-1 text-[11px] font-extrabold text-[var(--color-live)] animate-pulse">
                <LiveIcon className="h-3 w-3" />
                {minuteText}
              </span>
            )}
          </div>

          {/* Teams & Giant Live Score */}
          <div className="flex items-center justify-between gap-3 px-2">
            {/* Home Team */}
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-line-1)] bg-[var(--color-bg-3)] text-base font-black text-white shadow-inner">
                {homeName.trim().slice(0, 2).toUpperCase()}
              </div>
              <p className="text-[14px] font-extrabold text-white leading-tight">
                {homeName.trim()}
              </p>
            </div>

            {/* Score Center */}
            <div className="flex shrink-0 items-center justify-center px-4">
              <div className="mono flex items-center justify-center gap-3 text-[36px] font-black tracking-tight text-white whitespace-nowrap">
                <span>{event.score.home}</span>
                <span className="text-[var(--color-ink-4)]">–</span>
                <span>{event.score.away}</span>
              </div>
            </div>

            {/* Away Team */}
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-line-1)] bg-[var(--color-bg-3)] text-base font-black text-white shadow-inner">
                {awayName.trim().slice(0, 2).toUpperCase()}
              </div>
              <p className="text-[14px] font-extrabold text-white leading-tight">
                {awayName.trim()}
              </p>
            </div>
          </div>
        </div>

        {/* Status — the score itself is already the hero above; this adds
            only what that doesn't show (which stage, how far into it). */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]/50 px-3.5 py-2.5 text-[12px]">
            <span className="text-[var(--color-ink-2)]">Status</span>
            <span className="mono font-bold text-white">{statusLine}</span>
          </div>
        </div>

        {/* 2D Live Match Center */}
        {sportSlug === "football" && market && !isFinished && (
          <div className="px-5 pb-4">
            <LiveMatchCenter
              market={market}
            />
          </div>
        )}

        {/* Live Odds & Quick Action */}
        <div className="border-t border-[var(--color-line-1)] bg-[var(--color-bg-2)]/40 px-6 py-4">
          {market ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
                  <span className="mono rounded bg-[var(--color-ink-4)]/30 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-ink-3)]">LOCKED</span>
                  {isFinished ? "Match Concluded" : "Live In-Play (Prematch Closed)"}
                </span>
                <Link
                  href={`/sportsbook/match/${market.id}`}
                  onClick={onClose}
                  className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-brand-500)] hover:underline"
                >
                  Match Details <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Render 1X2 market odds locked */}
              {market.odds.find((o) => o.marketType === "1X2") && (
                <div className="grid grid-cols-3 gap-2">
                  {market.odds
                    .find((o) => o.marketType === "1X2")!
                    .selections.map((sel) => (
                      <OddsButton
                        key={sel.outcome}
                        matchId={market.id}
                        matchLabel={`${market.homeTeam} vs ${market.awayTeam}`}
                        market="1X2"
                        selection={sel.label}
                        label={sel.label}
                        odds={sel.valueX1000 / 1000}
                        disabled={true}
                      />
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-ink-3)]">
                {loadingMarket ? "Loading live odds..." : "Full match details available in Sportsbook"}
              </span>
              <Link
                href={`/sportsbook?sport=${sportSlug}`}
                onClick={onClose}
                className="flex items-center gap-1 rounded-md bg-[var(--color-brand-500)] px-3 py-1.5 text-[12px] font-bold text-black hover:bg-[var(--color-brand-400)] transition-colors"
              >
                Go to Sportsbook <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
