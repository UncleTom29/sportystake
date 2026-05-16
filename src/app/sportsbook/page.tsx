"use client";
import { useState } from "react";
import { matches } from "@/lib/mockData";
import MatchCard from "@/components/sportsbook/MatchCard";
import Sidebar from "@/components/layout/Sidebar";
import Badge from "@/components/ui/Badge";

const sports = ["All", "Football", "Basketball", "Tennis", "Baseball", "Ice Hockey", "MMA"];
const tabs = ["All Matches", "Live", "Today", "Tomorrow", "Upcoming"];

export default function SportsbookPage() {
  const [activeSport, setActiveSport] = useState("All");
  const [activeTab, setActiveTab] = useState("All Matches");

  const filtered = matches.filter((m) => {
    if (activeSport !== "All" && m.sport !== activeSport) return false;
    if (activeTab === "Live") return m.isLive;
    if (activeTab === "Today") return !m.isLive && m.time.includes("Today");
    if (activeTab === "Tomorrow") return m.time.includes("Tomorrow");
    return true;
  });

  const liveCount = matches.filter((m) => m.isLive).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
      <Sidebar />

      <div className="flex-1 min-w-0">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#0d2a1f] via-[#0d1f35] to-[#1a0d35] rounded-2xl p-5 mb-5 flex items-center justify-between overflow-hidden relative">
          <div className="relative z-10">
            <Badge variant="red">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                {liveCount} Live
              </span>
            </Badge>
            <h1 className="text-2xl font-black mt-2">Sportsbook</h1>
            <p className="text-gray-400 text-sm mt-1">12,400+ markets across 40+ sports</p>
          </div>
          <div className="text-6xl opacity-20 absolute right-6">⚽</div>
        </div>

        {/* Sport tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none mb-4">
          {sports.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSport(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeSport === s
                  ? "bg-green-500 text-black font-bold"
                  : "bg-[#111e2d] text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Time tabs */}
        <div className="flex gap-1 mb-5 bg-[#111e2d] p-1 rounded-xl border border-white/5 w-fit">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === t
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {t}
              {t === "Live" && liveCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1 rounded-full">{liveCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Matches grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-3">🔍</p>
            <p>No matches found for this filter</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
