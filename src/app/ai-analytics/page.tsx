import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const predictions = [
  {
    id: "ai1",
    match: "Arsenal vs Manchester City",
    league: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League",
    pick: "Over 2.5 Goals",
    confidence: 78,
    odds: 1.87,
    reasoning: "Both teams average 2.8 goals per game at home. Manchester City have scored in 9 of their last 10 away games. Arsenal's high press creates open play.",
    factors: ["Team form", "Head-to-head", "Weather", "Injuries"],
    trend: "up",
  },
  {
    id: "ai2",
    match: "LA Lakers vs Boston Celtics",
    league: "🏀 NBA",
    pick: "Boston Celtics ML",
    confidence: 71,
    odds: 1.78,
    reasoning: "Celtics are 8-2 in last 10 games. Lakers missing two starters. Boston's defensive rating is #1 in the league this month.",
    factors: ["Injury reports", "Recent form", "Defensive stats"],
    trend: "up",
  },
  {
    id: "ai3",
    match: "Bayern Munich vs Borussia Dortmund",
    league: "🇩🇪 Bundesliga",
    pick: "Bayern Win",
    confidence: 82,
    odds: 1.65,
    reasoning: "Bayern have won 7 consecutive Klassiker at home. Dortmund's away form is poor (3W-2D-5L). Bayern's xG is significantly higher.",
    factors: ["Historical H2H", "Home advantage", "xG data", "Squad depth"],
    trend: "steady",
  },
  {
    id: "ai4",
    match: "G2 Esports vs Fnatic",
    league: "🎮 LEC Summer Split",
    pick: "G2 Win",
    confidence: 68,
    odds: 1.45,
    reasoning: "G2 are in excellent form with a 6-1 record. Fnatic's jungler has a significantly lower KDA this split. Map control metrics favor G2.",
    factors: ["Recent performance", "Player stats", "Meta analysis"],
    trend: "up",
  },
];

const insights = [
  { icon: "📉", title: "Value Alert", desc: "Arsenal ML is priced at 2.85 but our model gives them a 42% implied probability — fair odds would be 2.38.", tag: "Value" },
  { icon: "🔥", title: "Hot Streak", desc: "CryptoTipster.eth is on an 8-bet winning streak. Similar patterns historically continue for 2-3 more bets.", tag: "Social" },
  { icon: "💧", title: "Line Movement", desc: "Manchester City ML has moved from 2.10 to 1.95 in the last 2 hours. Sharp money is backing City.", tag: "Odds" },
  { icon: "⚠️", title: "Injury Alert", desc: "Confirmed: Arsenal's Saka is doubtful for tonight's match. Adjust your Arsenal accumulator predictions.", tag: "News" },
];

export default function AIAnalyticsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-900/40 to-[#0d1821] rounded-3xl p-8 mb-6 border border-cyan-500/20">
        <div className="relative z-10">
          <Badge variant="blue">🤖 AI Analytics</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">AI-Powered Betting Insights</h1>
          <p className="text-gray-400 max-w-xl">
            Machine learning models analyze thousands of data points — form, stats, odds movements, injuries — to surface high-confidence picks and value bets.
          </p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">🤖</div>
      </div>

      {/* Live insights */}
      <div className="mb-6">
        <p className="font-bold mb-3">Live Insights</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {insights.map((ins) => (
            <div key={ins.title} className="bg-[#111e2d] border border-white/5 rounded-2xl p-4 flex gap-3">
              <span className="text-2xl">{ins.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{ins.title}</p>
                  <Badge variant="blue">{ins.tag}</Badge>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{ins.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Predictions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold">Today&apos;s AI Predictions</p>
          <p className="text-xs text-gray-500">Updated 5 min ago</p>
        </div>

        <div className="space-y-4">
          {predictions.map((p) => (
            <div key={p.id} className="bg-[#111e2d] border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{p.league}</p>
                    <p className="font-bold text-lg">{p.match}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className="text-xs text-gray-500">Confidence</span>
                      <span
                        className={`font-black text-lg ${
                          p.confidence >= 75 ? "text-green-400" : p.confidence >= 65 ? "text-yellow-400" : "text-gray-400"
                        }`}
                      >
                        {p.confidence}%
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="w-24 h-1.5 bg-[#1a2738] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.confidence >= 75 ? "bg-green-500" : p.confidence >= 65 ? "bg-yellow-500" : "bg-gray-500"
                        }`}
                        style={{ width: `${p.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Pick */}
                <div className="flex items-center gap-3 bg-[#1a2738] rounded-xl px-4 py-3 mb-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">AI Pick</p>
                    <p className="font-bold text-white">{p.pick}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Odds</p>
                    <p className="font-black text-green-400 text-lg">{p.odds.toFixed(2)}</p>
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-sm text-gray-400 mb-3 leading-relaxed">{p.reasoning}</p>

                {/* Factors */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.factors.map((f) => (
                    <span key={f} className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      {f}
                    </span>
                  ))}
                </div>

                <Button size="sm" variant="primary">Add to Slip</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 bg-[#111e2d] border border-white/5 rounded-2xl p-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Disclaimer:</strong> AI predictions are based on statistical analysis and historical data. They are not guaranteed outcomes. Always bet responsibly and within your means. Past model performance is not indicative of future results.
        </p>
      </div>
    </div>
  );
}
