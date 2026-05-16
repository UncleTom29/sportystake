import Link from "next/link";
import { matches, stats, casinoGames, esportsMatches } from "@/lib/mockData";
import MatchCard from "@/components/sportsbook/MatchCard";
import Badge from "@/components/ui/Badge";

const features = [
  { icon: "🔐", title: "Non-Custodial", desc: "Your keys, your funds. Bet directly from your wallet without giving up custody." },
  { icon: "⚡", title: "Instant Settlement", desc: "Winnings hit your wallet the moment the match ends. No delays, no friction." },
  { icon: "💧", title: "Liquidity Pools", desc: "Provide liquidity and earn a share of sportsbook profits automatically." },
  { icon: "🌍", title: "Borderless Access", desc: "Accessible globally with just a crypto wallet. No bank account required." },
];

const verticals = [
  { label: "Sportsbook", href: "/sportsbook", icon: "⚽", desc: "12,400+ live markets", color: "from-green-600 to-green-800" },
  { label: "Casino", href: "/casino", icon: "🎰", desc: "200+ games available", color: "from-purple-600 to-purple-900" },
  { label: "Esports", href: "/esports", icon: "🎮", desc: "CS2, Valorant, Dota 2", color: "from-blue-600 to-blue-900" },
  { label: "Fantasy", href: "/fantasy", icon: "🏆", desc: "Weekly crypto prizes", color: "from-yellow-600 to-yellow-900" },
  { label: "Social", href: "/social", icon: "👥", desc: "Copy expert bettors", color: "from-pink-600 to-pink-900" },
  { label: "AI Picks", href: "/ai-analytics", icon: "🤖", desc: "ML-powered insights", color: "from-cyan-600 to-cyan-900" },
];

export default function Home() {
  const liveMatches = matches.filter((m) => m.isLive).slice(0, 2);
  const featuredMatches = matches.filter((m) => !m.isLive).slice(0, 2);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d1f35] to-[#0a1520] border-b border-white/5">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(30,136,229,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,136,229,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center">
          <Badge variant="green" size="md">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Live on Arc Blockchain
            </span>
          </Badge>

          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            The Future of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
              Sports Betting
            </span>
            is Non-Custodial
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Bet on sports, play casino games, and earn yield — all from your crypto wallet.
            No sign-up. No KYC. Instant settlements.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/sportsbook"
              className="bg-green-500 hover:bg-green-400 text-black font-black px-8 py-3.5 rounded-2xl text-lg transition-colors shadow-lg shadow-green-500/20"
            >
              Start Betting
            </Link>
            <Link
              href="/pools"
              className="border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-3.5 rounded-2xl text-lg transition-colors"
            >
              Earn Yield
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Volume", value: `$${stats.totalVolume}` },
              { label: "Active Players", value: stats.activePlayers },
              { label: "Pool Liquidity", value: `$${stats.poolsLiquidity}` },
              { label: "Markets Live", value: stats.sportsMarkets },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-2xl px-4 py-4 border border-white/5">
                <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live now */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h2 className="text-lg font-bold">Live Now</h2>
          </div>
          <Link href="/sportsbook" className="text-sm text-green-400 hover:text-green-300">
            View all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {liveMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </section>

      {/* Product verticals */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-bold mb-4">Explore Platform</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {verticals.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className={`group relative overflow-hidden bg-gradient-to-br ${v.color} rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all hover:scale-105`}
            >
              <span className="text-3xl block mb-2">{v.icon}</span>
              <p className="font-bold text-white text-sm">{v.label}</p>
              <p className="text-xs text-white/60 mt-0.5">{v.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured matches */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Featured Matches</h2>
          <Link href="/sportsbook" className="text-sm text-green-400 hover:text-green-300">
            View all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {featuredMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-10 border-t border-white/5">
        <h2 className="text-2xl font-black text-center mb-8">Why SportyStake?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-[#111e2d] border border-white/5 rounded-2xl p-5">
              <span className="text-3xl block mb-3">{f.icon}</span>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured casino game */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Casino Highlights</h2>
          <Link href="/casino" className="text-sm text-green-400 hover:text-green-300">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {casinoGames.slice(0, 4).map((g) => (
            <Link
              key={g.id}
              href="/casino"
              className="group bg-[#111e2d] rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all hover:scale-[1.02]"
            >
              <div
                className="w-full h-20 rounded-xl flex items-center justify-center text-4xl mb-3"
                style={{ backgroundColor: g.color + "33" }}
              >
                {g.icon}
              </div>
              <p className="font-semibold text-sm">{g.name}</p>
              <p className="text-xs text-gray-500">{g.provider}</p>
              <p className="text-xs text-green-400 mt-1">RTP {g.rtp}%</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Esports */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Esports Betting</h2>
          <Link href="/esports" className="text-sm text-green-400 hover:text-green-300">
            View all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {esportsMatches.slice(0, 2).map((m) => (
            <Link
              key={m.id}
              href="/esports"
              className="bg-[#111e2d] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span>{m.gameIcon}</span>
                  <span className="text-xs text-gray-500">{m.tournament}</span>
                  {m.isLive && <Badge variant="red">LIVE</Badge>}
                </div>
                <p className="font-semibold text-sm">{m.team1}</p>
                <p className="font-semibold text-sm text-gray-400">vs {m.team2}</p>
              </div>
              <div className="flex gap-2">
                <div className="text-center bg-[#1a2f47] rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-500">{m.team1.split(" ")[0]}</p>
                  <p className="font-bold text-green-400">{m.team1Odds.toFixed(2)}</p>
                </div>
                <div className="text-center bg-[#1a2f47] rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-500">{m.team2.split(" ")[0]}</p>
                  <p className="font-bold text-green-400">{m.team2Odds.toFixed(2)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA pool */}
      <section className="max-w-6xl mx-auto px-4 py-10 mb-8">
        <div className="bg-gradient-to-r from-[#0d2a1f] to-[#0d1f35] border border-green-500/20 rounded-3xl p-8 text-center">
          <h2 className="text-2xl font-black mb-3">Earn Up to 18.2% APY</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            Provide liquidity to SportyStake&apos;s sportsbook pools and earn a share of platform profits. Transparent, non-custodial, instant rewards.
          </p>
          <Link
            href="/pools"
            className="inline-flex bg-green-500 hover:bg-green-400 text-black font-black px-8 py-3 rounded-2xl transition-colors shadow-lg shadow-green-500/20"
          >
            Explore Liquidity Pools
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0d1821]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-4 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-black text-black text-xs">SS</div>
                <span className="font-black">Sporty<span className="text-green-400">Stake</span></span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                The non-custodial crypto sportsbook built on Arc. Bet, earn, and play with full financial sovereignty.
              </p>
            </div>
            {[
              { title: "Platform", links: ["Sportsbook", "Casino", "Esports", "Fantasy"] },
              { title: "Earn", links: ["Liquidity Pools", "Referral Program", "Affiliate System"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Security"] },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-semibold text-sm mb-3">{col.title}</p>
                <div className="flex flex-col gap-2">
                  {col.links.map((l) => (
                    <span key={l} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors">{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p>© 2025 SportyStake. All rights reserved.</p>
            <p>18+ | Gamble Responsibly | Built on Arc</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
