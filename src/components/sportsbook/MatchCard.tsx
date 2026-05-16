"use client";
import { Match } from "@/lib/mockData";
import OddsButton from "./OddsButton";
import Badge from "@/components/ui/Badge";

export default function MatchCard({ match }: { match: Match }) {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;

  return (
    <div className="bg-[#111e2d] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{match.leagueIcon}</span>
          <span className="text-xs text-gray-500 font-medium">{match.league}</span>
        </div>
        <div className="flex items-center gap-2">
          {match.isLive ? (
            <Badge variant="red">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                {match.liveMinute ? `${match.liveMinute}'` : "LIVE"}
              </span>
            </Badge>
          ) : (
            <span className="text-xs text-gray-500">{match.time}</span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{match.homeTeam}</span>
            {match.isLive && (
              <span className={`font-black text-lg ${match.homeScore! > match.awayScore! ? "text-green-400" : "text-white"}`}>
                {match.homeScore}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{match.awayTeam}</span>
            {match.isLive && (
              <span className={`font-black text-lg ${match.awayScore! > match.homeScore! ? "text-green-400" : "text-white"}`}>
                {match.awayScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Odds */}
      <div className="flex items-center gap-2 flex-wrap">
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.homeTeam}
          odds={match.homeOdds}
        />
        {match.drawOdds && (
          <OddsButton
            matchId={match.id}
            matchLabel={label}
            market="Match Winner"
            selection="Draw"
            odds={match.drawOdds}
          />
        )}
        <OddsButton
          matchId={match.id}
          matchLabel={label}
          market="Match Winner"
          selection={match.awayTeam}
          odds={match.awayOdds}
        />

        {match.totalLine && match.totalOverOdds && match.totalUnderOdds && (
          <>
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market={`Over/Under ${match.totalLine}`}
              selection={`Over ${match.totalLine}`}
              odds={match.totalOverOdds}
            />
            <OddsButton
              matchId={match.id}
              matchLabel={label}
              market={`Over/Under ${match.totalLine}`}
              selection={`Under ${match.totalLine}`}
              odds={match.totalUnderOdds}
            />
          </>
        )}
      </div>

      {/* More markets */}
      <button className="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors text-center">
        +18 more markets →
      </button>
    </div>
  );
}
