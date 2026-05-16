import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Link from "next/link";

const contests = [
  { id: "f1", name: "EPL Weekend Classic", sport: "⚽ Football", prize: "$5,000 USDT", entries: 842, maxEntries: 1000, entryFee: "$5", closes: "Sat 14:00", type: "tournament" },
  { id: "f2", name: "NBA Daily Showdown", sport: "🏀 Basketball", prize: "$2,500 USDT", entries: 320, maxEntries: 500, entryFee: "$10", closes: "Today 23:00", type: "tournament" },
  { id: "f3", name: "Mega Jackpot", sport: "⚽ Football", prize: "$25,000 USDT", entries: 12840, maxEntries: 50000, entryFee: "$2", closes: "Sun 16:00", type: "mega" },
  { id: "f4", name: "Free Roll Sunday", sport: "🏆 Multi-sport", prize: "$500 USDT", entries: 2041, maxEntries: 5000, entryFee: "FREE", closes: "Sun 12:00", type: "free" },
];

const leaderboard = [
  { rank: 1, user: "crypto_king.eth", points: 284, prize: "$500 USDT" },
  { rank: 2, user: "BetWizard99", points: 271, prize: "$250 USDT" },
  { rank: 3, user: "MoonBettor", points: 265, prize: "$100 USDT" },
  { rank: 4, user: "You", points: 241, prize: "$50 USDT", isMe: true },
  { rank: 5, user: "Zeroday.arc", points: 239, prize: "$25 USDT" },
];

export default function FantasyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-yellow-900/40 to-[#0d1821] rounded-3xl p-8 mb-6 border border-yellow-500/20">
        <div className="relative z-10">
          <Badge variant="yellow">🏆 Fantasy Sports</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">Fantasy Sports</h1>
          <p className="text-gray-400 max-w-xl">
            Build your lineup, compete in tournaments, and win crypto prizes. New contests every day across football, basketball, MMA, and more.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="primary">Create Lineup</Button>
            <Button variant="secondary">View My Contests</Button>
          </div>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">🏆</div>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { step: "1", title: "Pick Your Players", desc: "Select athletes from today's fixtures within your salary cap." },
          { step: "2", title: "Enter a Contest", desc: "Join a public tournament or create a private contest with friends." },
          { step: "3", title: "Win Crypto", desc: "Earn points from real-world stats. Top scorers win crypto prizes." },
        ].map((s) => (
          <div key={s.step} className="bg-[#111e2d] border border-white/5 rounded-2xl p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 font-black flex items-center justify-center shrink-0">
              {s.step}
            </div>
            <div>
              <p className="font-bold text-sm mb-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Contests */}
        <div className="lg:col-span-2">
          <p className="font-bold mb-3">Open Contests</p>
          <div className="space-y-3">
            {contests.map((c) => {
              const fillPct = (c.entries / c.maxEntries) * 100;
              return (
                <div key={c.id} className="bg-[#111e2d] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{c.sport}</span>
                        {c.type === "mega" && <Badge variant="yellow">MEGA</Badge>}
                        {c.type === "free" && <Badge variant="green">FREE</Badge>}
                      </div>
                      <p className="font-bold">{c.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-black">{c.prize}</p>
                      <p className="text-xs text-gray-500">Prize Pool</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{c.entries.toLocaleString()} / {c.maxEntries.toLocaleString()} entries</span>
                      <span>Closes {c.closes}</span>
                    </div>
                    <div className="h-1.5 bg-[#1a2738] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{c.entryFee} entry</span>
                    <Button size="sm" variant="primary">Enter Contest</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <p className="font-bold mb-3">Weekly Leaderboard</p>
          <div className="bg-[#111e2d] border border-white/5 rounded-2xl overflow-hidden">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 ${
                  entry.isMe ? "bg-green-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      entry.rank === 1
                        ? "bg-yellow-500 text-black"
                        : entry.rank === 2
                        ? "bg-gray-400 text-black"
                        : entry.rank === 3
                        ? "bg-orange-600 text-white"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${entry.isMe ? "text-green-400" : "text-white"}`}>
                      {entry.user}
                      {entry.isMe && " (you)"}
                    </p>
                    <p className="text-xs text-gray-500">{entry.points} pts</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-green-400">{entry.prize}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">Resets every Sunday midnight UTC</p>
        </div>
      </div>
    </div>
  );
}
