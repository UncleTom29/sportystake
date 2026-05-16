"use client";
import { useState } from "react";
import { casinoGames } from "@/lib/mockData";
import Badge from "@/components/ui/Badge";

const categories = ["All", "Slots", "Table", "Live", "Crash", "Dice"];

export default function CasinoPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = casinoGames.filter((g) => {
    if (activeCategory !== "All" && g.category !== activeCategory) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900/60 via-[#1a0d35] to-[#0d1821] rounded-3xl p-8 mb-6 border border-purple-500/20">
        <div className="relative z-10">
          <Badge variant="blue">🎰 Casino</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">Crypto Casino</h1>
          <p className="text-gray-400 max-w-lg">
            200+ games including slots, live dealer, crash, dice, and table games. All powered by provably fair crypto infrastructure.
          </p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">🎰</div>
      </div>

      {/* Crash game hero */}
      <div className="bg-gradient-to-r from-[#1a0d35] to-[#0d1821] border border-purple-500/20 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1">Featured Game</p>
            <h2 className="text-xl font-black">🚀 Crash Rocket</h2>
            <p className="text-gray-400 text-sm mt-1">Cash out before the rocket crashes. Pure adrenaline.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-purple-400">2.48×</p>
              <p className="text-xs text-gray-500">Last crash</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">147</p>
              <p className="text-xs text-gray-500">Playing now</p>
            </div>
            <button className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
              Play Now
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search games..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-[#111e2d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
        />
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === c
                  ? "bg-purple-600 text-white"
                  : "bg-[#111e2d] text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((g) => (
          <button
            key={g.id}
            className="group bg-[#111e2d] border border-white/5 hover:border-white/15 rounded-2xl p-4 text-left transition-all hover:scale-[1.02]"
          >
            <div
              className="w-full h-24 rounded-xl flex items-center justify-center text-5xl mb-3 transition-all group-hover:scale-110"
              style={{ backgroundColor: g.color + "25" }}
            >
              {g.icon}
            </div>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">{g.name}</p>
              <Badge variant="gray">{g.category}</Badge>
            </div>
            <p className="text-xs text-gray-500">{g.provider}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-green-400 font-semibold">RTP {g.rtp}%</span>
              <span className="text-xs text-gray-600">Max {g.maxBet} USDT</span>
            </div>
          </button>
        ))}
      </div>

      {/* Responsible gambling */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-600">
          🔞 18+ only. Gamble responsibly. SportyStake promotes responsible gaming.
          <span className="text-gray-500 ml-1">Set limits in your account settings.</span>
        </p>
      </div>
    </div>
  );
}
