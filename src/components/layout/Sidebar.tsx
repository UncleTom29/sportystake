"use client";
import { useState } from "react";

const sports = [
  { label: "All Sports", icon: "🌐", count: 248 },
  { label: "Football", icon: "⚽", count: 124 },
  { label: "Basketball", icon: "🏀", count: 38 },
  { label: "Tennis", icon: "🎾", count: 22 },
  { label: "Baseball", icon: "⚾", count: 14 },
  { label: "Ice Hockey", icon: "🏒", count: 18 },
  { label: "MMA / UFC", icon: "🥊", count: 8 },
  { label: "American Football", icon: "🏈", count: 10 },
  { label: "Cricket", icon: "🏏", count: 16 },
  { label: "Rugby", icon: "🏉", count: 9 },
  { label: "Volleyball", icon: "🏐", count: 11 },
  { label: "Table Tennis", icon: "🏓", count: 6 },
];

const leagues = [
  { label: "Premier League", icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", live: 3 },
  { label: "La Liga", icon: "🇪🇸", live: 2 },
  { label: "Bundesliga", icon: "🇩🇪", live: 1 },
  { label: "Serie A", icon: "🇮🇹", live: 2 },
  { label: "Ligue 1", icon: "🇫🇷", live: 0 },
  { label: "Champions League", icon: "⭐", live: 0 },
  { label: "NBA", icon: "🏀", live: 4 },
  { label: "ATP Tour", icon: "🎾", live: 1 },
];

export default function Sidebar() {
  const [activeSport, setActiveSport] = useState("Football");

  return (
    <aside className="w-56 shrink-0 hidden xl:flex flex-col gap-4 pt-4">
      {/* Sports */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Sports</p>
        <div className="flex flex-col gap-0.5">
          {sports.map((s) => (
            <button
              key={s.label}
              onClick={() => setActiveSport(s.label)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSport === s.label
                  ? "bg-green-500/10 text-green-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </span>
              <span className="text-xs text-gray-600">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Leagues */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Top Leagues</p>
        <div className="flex flex-col gap-0.5">
          {leagues.map((l) => (
            <button
              key={l.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </span>
              {l.live > 0 && (
                <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">
                  {l.live} LIVE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
