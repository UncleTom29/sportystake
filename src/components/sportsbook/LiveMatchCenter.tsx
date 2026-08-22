"use client";

import { useState, useEffect, useMemo } from "react";
import type { MarketDTO } from "@/lib/types";
import { Activity, Shield, Flame, Trophy, Flag, AlertCircle, RefreshCw, BarChart2, Eye, EyeOff } from "lucide-react";

interface Props {
  market: MarketDTO;
  homeColor?: string;
  awayColor?: string;
}

type CenterTab = "pitch" | "stats" | "timeline";

interface ActionState {
  label: string;
  side: "home" | "away" | "neutral";
  x: number; // 0 to 100 on pitch width
  y: number; // 0 to 100 on pitch height
  isDangerous: boolean;
}

const ACTION_STATES: ActionState[] = [
  { label: "Dangerous Attack", side: "home", x: 78, y: 48, isDangerous: true },
  { label: "Ball in Midfield", side: "neutral", x: 50, y: 50, isDangerous: false },
  { label: "Attacking Third", side: "away", x: 26, y: 52, isDangerous: false },
  { label: "Corner Kick", side: "home", x: 88, y: 85, isDangerous: true },
  { label: "Defensive Clearance", side: "away", x: 18, y: 50, isDangerous: false },
  { label: "Counter Attack", side: "away", x: 38, y: 42, isDangerous: true },
  { label: "Shot on Target", side: "home", x: 84, y: 50, isDangerous: true },
  { label: "Free Kick", side: "away", x: 32, y: 65, isDangerous: false },
  { label: "Possession Building", side: "home", x: 62, y: 35, isDangerous: false },
];

export default function LiveMatchCenter({ market, homeColor = "#00E701", awayColor = "#3B82F6" }: Props) {
  const [activeTab, setActiveTab] = useState<CenterTab>("pitch");
  const [collapsed, setCollapsed] = useState(false);
  const [actionIdx, setActionIdx] = useState(0);

  const isLive = market.status === "LIVE";
  const sport = (market.sport || "football").toLowerCase();

  // Pseudo real-time tactical coordinate simulation for in-play immersion
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setActionIdx((prev) => (prev + 1) % ACTION_STATES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isLive]);

  const currentAction = isLive ? ACTION_STATES[actionIdx] : { label: market.status === "SETTLED" ? "Full Time" : "Scheduled Kickoff", side: "neutral" as const, x: 50, y: 50, isDangerous: false };

  // Derived match stats (seeded from fixture score & minute for consistency)
  const stats = useMemo(() => {
    const seed = Number(market.fixtureId || 100);
    const homeScore = market.homeScore ?? 0;
    const awayScore = market.awayScore ?? 0;
    const minute = market.liveMinute || (market.status === "SETTLED" ? 90 : 0);

    const basePossession = 50 + (homeScore - awayScore) * 4 + ((seed % 15) - 7);
    const homePoss = Math.min(68, Math.max(32, basePossession));
    const awayPoss = 100 - homePoss;

    const homeShots = Math.max(homeScore, Math.floor((minute / 90) * 12) + (seed % 4));
    const awayShots = Math.max(awayScore, Math.floor((minute / 90) * 10) + ((seed + 2) % 4));

    const homeOnTarget = Math.max(homeScore, Math.floor(homeShots * 0.45));
    const awayOnTarget = Math.max(awayScore, Math.floor(awayShots * 0.42));

    const homeCorners = Math.floor((minute / 90) * 6) + (seed % 3);
    const awayCorners = Math.floor((minute / 90) * 5) + ((seed + 1) % 3);

    const homeYellows = (seed % 3);
    const awayYellows = ((seed + 1) % 3);

    const homeDangerous = Math.floor(homeShots * 3.8);
    const awayDangerous = Math.floor(awayShots * 3.5);

    return {
      possession: { home: homePoss, away: awayPoss },
      shots: { home: homeShots, away: awayShots },
      shotsOnTarget: { home: homeOnTarget, away: awayOnTarget },
      corners: { home: homeCorners, away: awayCorners },
      yellows: { home: homeYellows, away: awayYellows },
      dangerousAttacks: { home: homeDangerous, away: awayDangerous },
      fouls: { home: 8 + (seed % 5), away: 9 + ((seed + 2) % 5) },
    };
  }, [market.fixtureId, market.homeScore, market.awayScore, market.liveMinute, market.status]);

  if (collapsed) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-brand-500)]" />
          <span className="text-[12px] font-bold text-white">Live Match Center</span>
          {isLive && (
            <span className="mono rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
              LIVE {market.liveMinute ? `${market.liveMinute}'` : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-500)] hover:underline"
        >
          <Eye className="h-3.5 w-3.5" />
          Show Visualizer
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] shadow-2xl">
      {/* Visualizer Top Bar & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <span className="text-[13px] font-bold text-white">2D Live Match Center</span>
          {isLive ? (
            <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[var(--color-live)] border border-[var(--color-live)]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] animate-pulse" />
              Live In-Play
            </span>
          ) : (
            <span className="mono rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-2)]">
              {market.status === "SETTLED" ? "Final" : "Prematch"}
            </span>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("pitch")}
            className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
              activeTab === "pitch"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            2D Pitch
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
              activeTab === "stats"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            Stats Comparison
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
              activeTab === "timeline"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            Events Timeline
          </button>

          <button
            onClick={() => setCollapsed(true)}
            className="ml-2 rounded-lg p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-bg-2)] hover:text-white transition-colors"
            title="Collapse Visualizer"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab 1: 2D Pitch Visualizer */}
      {activeTab === "pitch" && (
        <div className="p-4 sm:p-6">
          {/* Action Status Banner */}
          <div className="mb-3 flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full animate-ping"
                style={{
                  backgroundColor:
                    currentAction.side === "home"
                      ? homeColor
                      : currentAction.side === "away"
                      ? awayColor
                      : "#94a3b8",
                }}
              />
              <span className="font-bold text-white">
                {currentAction.side === "home"
                  ? `${market.homeTeam}: `
                  : currentAction.side === "away"
                  ? `${market.awayTeam}: `
                  : ""}
                <span className={currentAction.isDangerous ? "text-[var(--color-live)]" : "text-white"}>
                  {currentAction.label}
                </span>
              </span>
            </div>

            <div className="mono flex items-center gap-3 text-[11px] text-[var(--color-ink-3)]">
              <span>Poss: {stats.possession.home}% - {stats.possession.away}%</span>
              <span>Attacks: {stats.dangerousAttacks.home} - {stats.dangerousAttacks.away}</span>
            </div>
          </div>

          {/* 2D Pitch Field Canvas */}
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-emerald-900/60 bg-gradient-to-b from-[#0b3318] via-[#092b14] to-[#072210] shadow-inner">
            {/* Pitch Grass Stripes */}
            <div className="absolute inset-0 grid grid-cols-12 opacity-30">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={i % 2 === 0 ? "bg-emerald-950/40" : "bg-transparent"} />
              ))}
            </div>

            {/* Pitch Markings SVG */}
            <svg className="absolute inset-0 h-full w-full stroke-emerald-400/30" strokeWidth="1.5" fill="none">
              {/* Outer boundary */}
              <rect x="2%" y="4%" width="96%" height="92%" rx="4" />
              {/* Half-way line */}
              <line x1="50%" y1="4%" x2="50%" y2="96%" />
              {/* Center circle */}
              <circle cx="50%" cy="50%" r="14%" />
              <circle cx="50%" cy="50%" r="0.8%" fill="currentColor" />

              {/* Left Penalty Area (Home) */}
              <rect x="2%" y="22%" width="15%" height="56%" />
              <rect x="2%" y="36%" width="5%" height="28%" />
              <path d="M 17% 42% A 8% 8% 0 0 1 17% 58%" />

              {/* Right Penalty Area (Away) */}
              <rect x="83%" y="22%" width="15%" height="56%" />
              <rect x="93%" y="36%" width="5%" height="28%" />
              <path d="M 83% 42% A 8% 8% 0 0 0 83% 58%" />

              {/* Corner arcs */}
              <path d="M 2% 8% A 2% 2% 0 0 0 4% 4%" />
              <path d="M 2% 92% A 2% 2% 0 0 1 4% 96%" />
              <path d="M 98% 8% A 2% 2% 0 0 1 96% 4%" />
              <path d="M 98% 92% A 2% 2% 0 0 0 96% 96%" />
            </svg>

            {/* Team Badges on pitch sides */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-center">
              <p className="text-4xl font-black text-white">{market.homeTeam.slice(0, 3).toUpperCase()}</p>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-center">
              <p className="text-4xl font-black text-white">{market.awayTeam.slice(0, 3).toUpperCase()}</p>
            </div>

            {/* Animated Ball & Vector Action Indicator */}
            {isLive && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                style={{ left: `${currentAction.x}%`, top: `${currentAction.y}%` }}
              >
                {/* Pulsing Radar Glow */}
                <div
                  className="absolute -inset-4 rounded-full opacity-60 animate-ping"
                  style={{
                    backgroundColor:
                      currentAction.side === "home"
                        ? homeColor
                        : currentAction.side === "away"
                        ? awayColor
                        : "#ffffff",
                  }}
                />
                <div
                  className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-xl"
                  style={{
                    backgroundColor:
                      currentAction.side === "home"
                        ? homeColor
                        : currentAction.side === "away"
                        ? awayColor
                        : "#ffffff",
                  }}
                >
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>

                {/* Floating Action Tag */}
                <div className="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-md shadow-lg border border-white/10">
                  {currentAction.label}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Stats Comparison */}
      {activeTab === "stats" && (
        <div className="p-5 space-y-4">
          <StatBar
            label="Ball Possession"
            homeVal={`${stats.possession.home}%`}
            awayVal={`${stats.possession.away}%`}
            homePercent={stats.possession.home}
            homeColor={homeColor}
            awayColor={awayColor}
          />
          <StatBar
            label="Total Shots"
            homeVal={String(stats.shots.home)}
            awayVal={String(stats.shots.away)}
            homePercent={(stats.shots.home / (stats.shots.home + stats.shots.away || 1)) * 100}
            homeColor={homeColor}
            awayColor={awayColor}
          />
          <StatBar
            label="Shots on Target"
            homeVal={String(stats.shotsOnTarget.home)}
            awayVal={String(stats.shotsOnTarget.away)}
            homePercent={(stats.shotsOnTarget.home / (stats.shotsOnTarget.home + stats.shotsOnTarget.away || 1)) * 100}
            homeColor={homeColor}
            awayColor={awayColor}
          />
          <StatBar
            label="Dangerous Attacks"
            homeVal={String(stats.dangerousAttacks.home)}
            awayVal={String(stats.dangerousAttacks.away)}
            homePercent={(stats.dangerousAttacks.home / (stats.dangerousAttacks.home + stats.dangerousAttacks.away || 1)) * 100}
            homeColor={homeColor}
            awayColor={awayColor}
          />
          <StatBar
            label="Corner Kicks"
            homeVal={String(stats.corners.home)}
            awayVal={String(stats.corners.away)}
            homePercent={(stats.corners.home / (stats.corners.home + stats.corners.away || 1)) * 100}
            homeColor={homeColor}
            awayColor={awayColor}
          />
          <StatBar
            label="Fouls & Discipline"
            homeVal={String(stats.fouls.home)}
            awayVal={String(stats.fouls.away)}
            homePercent={(stats.fouls.home / (stats.fouls.home + stats.fouls.away || 1)) * 100}
            homeColor={homeColor}
            awayColor={awayColor}
          />
        </div>
      )}

      {/* Tab 3: Match Events Timeline */}
      {activeTab === "timeline" && (
        <div className="p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[12px]">
              <span className="mono font-bold text-[var(--color-ink-3)] w-8">01'</span>
              <div className="h-2 w-2 rounded-full bg-[var(--color-brand-500)]" />
              <p className="text-white font-medium">First half kickoff</p>
            </div>

            {(market.homeScore ?? 0) > 0 && (
              <div className="flex items-center gap-3 text-[12px] bg-[var(--color-brand-500)]/10 p-2.5 rounded-xl border border-[var(--color-brand-500)]/20">
                <span className="mono font-black text-[var(--color-brand-500)] w-8">24'</span>
                <Trophy className="h-4 w-4 text-[var(--color-brand-500)]" />
                <p className="text-white font-bold">
                  GOAL! {market.homeTeam} scores ({market.homeScore} - 0)
                </p>
              </div>
            )}

            {(market.awayScore ?? 0) > 0 && (
              <div className="flex items-center gap-3 text-[12px] bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
                <span className="mono font-black text-blue-400 w-8">39'</span>
                <Trophy className="h-4 w-4 text-blue-400" />
                <p className="text-white font-bold">
                  GOAL! {market.awayTeam} scores ({market.homeScore} - {market.awayScore})
                </p>
              </div>
            )}

            {market.status === "LIVE" && (
              <div className="flex items-center gap-3 text-[12px] text-[var(--color-live)] animate-pulse">
                <span className="mono font-black w-8">{market.liveMinute || 45}'</span>
                <Activity className="h-4 w-4" />
                <p className="font-bold">Match currently in-play</p>
              </div>
            )}

            {market.status === "SETTLED" && (
              <div className="flex items-center gap-3 text-[12px] text-[var(--color-ink-2)]">
                <span className="mono font-bold w-8">90'</span>
                <div className="h-2 w-2 rounded-full bg-slate-500" />
                <p className="font-bold">Full time whistle ({market.homeScore} - {market.awayScore})</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({
  label,
  homeVal,
  awayVal,
  homePercent,
  homeColor,
  awayColor,
}: {
  label: string;
  homeVal: string;
  awayVal: string;
  homePercent: number;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="mono font-black text-white">{homeVal}</span>
        <span className="font-bold text-[var(--color-ink-2)]">{label}</span>
        <span className="mono font-black text-white">{awayVal}</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-3)]">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${homePercent}%`, backgroundColor: homeColor }}
        />
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${100 - homePercent}%`, backgroundColor: awayColor }}
        />
      </div>
    </div>
  );
}
