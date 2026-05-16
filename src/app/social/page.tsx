import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const topBettors = [
  { rank: 1, handle: "CryptoTipster.eth", avatar: "🦁", followers: 4820, winRate: 67.2, roi: 22.4, streak: 8, badge: "🔥 Hot" },
  { rank: 2, handle: "GoalMachine99", avatar: "⚽", followers: 2940, winRate: 61.5, roi: 18.1, streak: 5, badge: "📈 Rising" },
  { rank: 3, handle: "OddsWizard.arc", avatar: "🧙", followers: 1870, winRate: 59.8, roi: 14.8, streak: 3, badge: null },
  { rank: 4, handle: "SlateBreaker", avatar: "💎", followers: 1240, winRate: 58.3, roi: 11.2, streak: 0, badge: null },
  { rank: 5, handle: "QuantBet_", avatar: "🤖", followers: 980, winRate: 56.7, roi: 9.8, streak: 4, badge: null },
];

const publicSlips = [
  {
    id: "ps1",
    user: "CryptoTipster.eth",
    avatar: "🦁",
    time: "2h ago",
    selections: [
      { match: "Arsenal vs Man City", pick: "Arsenal Win", odds: 2.85 },
      { match: "Real Madrid vs Barcelona", pick: "Over 2.5", odds: 1.80 },
    ],
    stake: 100,
    status: "open",
    copies: 142,
  },
  {
    id: "ps2",
    user: "GoalMachine99",
    avatar: "⚽",
    time: "4h ago",
    selections: [
      { match: "Bayern vs Dortmund", pick: "Bayern Win", odds: 1.65 },
    ],
    stake: 50,
    status: "won",
    copies: 89,
    result: "+32.50 USDT",
  },
  {
    id: "ps3",
    user: "OddsWizard.arc",
    avatar: "🧙",
    time: "6h ago",
    selections: [
      { match: "Chelsea vs Liverpool", pick: "Draw", odds: 3.20 },
      { match: "Inter vs AC Milan", pick: "Inter Win", odds: 2.30 },
      { match: "LA Lakers vs Boston Celtics", pick: "Over 221.5", odds: 1.90 },
    ],
    stake: 30,
    status: "open",
    copies: 67,
  },
];

export default function SocialPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-pink-900/40 to-[#0d1821] rounded-3xl p-8 mb-6 border border-pink-500/20">
        <div className="relative z-10">
          <Badge variant="red">👥 Social Betting</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">Copy the Best Bettors</h1>
          <p className="text-gray-400 max-w-xl">
            Follow top bettors, copy their picks, and compete on leaderboards. Turn sports betting into a community experience.
          </p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">👥</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Feed */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold">Latest Public Slips</p>
            <div className="flex gap-2">
              {["All", "Following", "Hot"].map((t) => (
                <button
                  key={t}
                  className="text-xs px-3 py-1 rounded-lg bg-[#111e2d] text-gray-400 hover:text-white border border-white/5 transition-colors first:text-white first:border-white/20"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {publicSlips.map((slip) => {
              const parlayOdds = slip.selections.reduce((acc, s) => acc * s.odds, 1);
              return (
                <div key={slip.id} className="bg-[#111e2d] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{slip.avatar}</span>
                      <div>
                        <p className="font-semibold text-sm">{slip.user}</p>
                        <p className="text-xs text-gray-500">{slip.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {slip.status === "won" ? (
                        <Badge variant="green">✓ Won</Badge>
                      ) : (
                        <Badge variant="gray">Open</Badge>
                      )}
                      {slip.result && <span className="text-green-400 font-bold text-sm">{slip.result}</span>}
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    {slip.selections.map((sel, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#1a2738] rounded-xl px-3 py-2">
                        <div>
                          <p className="text-xs text-gray-500">{sel.match}</p>
                          <p className="text-sm font-semibold">{sel.pick}</p>
                        </div>
                        <span className="text-green-400 font-bold">{sel.odds.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Stake: <span className="text-white">{slip.stake} USDT</span></span>
                      {slip.selections.length > 1 && (
                        <span>Parlay: <span className="text-yellow-400 font-bold">{parlayOdds.toFixed(2)}×</span></span>
                      )}
                      <span>👥 {slip.copies} copies</span>
                    </div>
                    <Button size="sm" variant="secondary">Copy Bet</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <p className="font-bold mb-3">Top Bettors</p>
          <div className="space-y-2">
            {topBettors.map((b) => (
              <div key={b.rank} className="bg-[#111e2d] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{b.avatar}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm">{b.handle}</p>
                        {b.badge && <span className="text-xs">{b.badge}</span>}
                      </div>
                      <p className="text-xs text-gray-500">{b.followers.toLocaleString()} followers</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">Follow</Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#1a2738] rounded-lg py-1.5">
                    <p className="text-sm font-bold text-green-400">{b.winRate}%</p>
                    <p className="text-xs text-gray-600">Win rate</p>
                  </div>
                  <div className="bg-[#1a2738] rounded-lg py-1.5">
                    <p className="text-sm font-bold text-blue-400">+{b.roi}%</p>
                    <p className="text-xs text-gray-600">ROI</p>
                  </div>
                  <div className="bg-[#1a2738] rounded-lg py-1.5">
                    <p className="text-sm font-bold text-yellow-400">{b.streak}🔥</p>
                    <p className="text-xs text-gray-600">Streak</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
