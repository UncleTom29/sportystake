"use client";
import { useState } from "react";
import { esportsMatches } from "@/lib/mockData";
import Badge from "@/components/ui/Badge";
import OddsButton from "@/components/sportsbook/OddsButton";

const games = ["All", "CS2", "Valorant", "Dota 2", "LoL", "FIFA", "CoD"];

export default function EsportsPage() {
  const [activeGame, setActiveGame] = useState("All");

  const filtered = esportsMatches.filter(
    (m) => activeGame === "All" || m.game === activeGame
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/60 to-[#0d1821] rounded-3xl p-8 mb-6 border border-blue-500/20">
        <div className="relative z-10">
          <Badge variant="blue">🎮 Esports</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">Esports Betting</h1>
          <p className="text-gray-400">Bet on CS2, Valorant, Dota 2, LoL, and more. Live odds, real-time updates.</p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">🎮</div>
      </div>

      {/* Game filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none mb-5">
        {games.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGame(g)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeGame === g
                ? "bg-blue-600 text-white"
                : "bg-[#111e2d] text-gray-400 hover:text-white border border-white/5"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Live section */}
      {filtered.some((m) => m.isLive) && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-bold text-sm">Live Now</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered
              .filter((m) => m.isLive)
              .map((m) => (
                <EsportsMatchCard key={m.id} match={m} />
              ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div>
        <p className="font-bold text-sm mb-3 text-gray-400">Upcoming</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered
            .filter((m) => !m.isLive)
            .map((m) => (
              <EsportsMatchCard key={m.id} match={m} />
            ))}
        </div>
      </div>
    </div>
  );
}

function EsportsMatchCard({ match }: { match: (typeof esportsMatches)[0] }) {
  return (
    <div className="bg-[#111e2d] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{match.gameIcon}</span>
          <span className="text-xs text-gray-500 font-medium">{match.tournament}</span>
        </div>
        {match.isLive ? (
          <Badge variant="red">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
              LIVE
            </span>
          </Badge>
        ) : (
          <span className="text-xs text-gray-500">{match.time}</span>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-5 rounded bg-blue-600/30 flex items-center justify-center text-xs">T1</span>
          <span className="font-semibold">{match.team1}</span>
        </div>
        <div className="text-xs text-gray-600 pl-7 mb-1">vs</div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-red-600/30 flex items-center justify-center text-xs">T2</span>
          <span className="font-semibold">{match.team2}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <OddsButton
          matchId={match.id}
          matchLabel={`${match.team1} vs ${match.team2}`}
          market="Match Winner"
          selection={match.team1}
          odds={match.team1Odds}
        />
        <OddsButton
          matchId={match.id}
          matchLabel={`${match.team1} vs ${match.team2}`}
          market="Match Winner"
          selection={match.team2}
          odds={match.team2Odds}
        />
      </div>
    </div>
  );
}
