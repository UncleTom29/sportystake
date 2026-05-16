import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import { SparkleIcon, TrendUp, TrendDown, ZapIcon, BadgeCheck, FlameIcon } from "@/components/icons/UIIcons";

const predictions = [
  {
    id: "ai1",
    match: "Arsenal vs Manchester City",
    league: "Premier League · ENG",
    pick: "Over 2.5 Goals",
    confidence: 78,
    odds: 1.87,
    fair: 1.61,
    valueBps: 14,
    reasoning:
      "Both teams average 2.8 goals per game at home. Manchester City have scored in 9 of their last 10 away games. Arsenal's high press creates open play.",
    factors: ["Team form", "Head-to-head", "xG trend", "Injuries"],
    direction: "up" as const,
  },
  {
    id: "ai2",
    match: "Lakers vs Celtics",
    league: "NBA · USA",
    pick: "Boston Celtics ML",
    confidence: 71,
    odds: 1.78,
    fair: 1.66,
    valueBps: 8,
    reasoning:
      "Celtics 8-2 in last 10. Lakers missing two starters. Boston's defensive rating ranks #1 over the trailing 30 days.",
    factors: ["Injury reports", "Recent form", "Defensive stats"],
    direction: "up" as const,
  },
  {
    id: "ai3",
    match: "Bayern Munich vs Borussia Dortmund",
    league: "Bundesliga · GER",
    pick: "Bayern Win",
    confidence: 82,
    odds: 1.65,
    fair: 1.4,
    valueBps: 22,
    reasoning:
      "Bayern have won 7 consecutive Klassikers at home. Dortmund's away xGD is -0.6/match. Squad depth gap pronounced.",
    factors: ["Historical H2H", "Home advantage", "xG data", "Squad depth"],
    direction: "down" as const,
  },
  {
    id: "ai4",
    match: "G2 Esports vs Fnatic",
    league: "LEC · INT",
    pick: "G2 Win",
    confidence: 68,
    odds: 1.45,
    fair: 1.32,
    valueBps: 6,
    reasoning:
      "G2 are 6-1 this split. Fnatic's jungler KDA is the lowest in the league. Map control favors G2 dramatically.",
    factors: ["Recent performance", "Player stats", "Meta analysis"],
    direction: "up" as const,
  },
];

const insights = [
  { tag: "VALUE", title: "Arsenal ML mispriced", desc: "Model gives 42% implied probability vs market 35%. Fair odds 2.38.", accent: "var(--color-brand-500)" },
  { tag: "SHARP", title: "Manchester City line moved", desc: "From 2.10 → 1.95 over 2h. 87% of stake-weighted volume on City.", accent: "var(--color-info)" },
  { tag: "INJURY", title: "Saka downgraded to doubtful", desc: "Adjust any Arsenal accumulators. Bookmaker odds lag 22 minutes.", accent: "var(--color-warn)" },
  { tag: "SOCIAL", title: "CryptoTipster on +8 streak", desc: "Historical extension probability of similar streaks: 41% for next bet.", accent: "#a78bfa" },
];

export default function AIAnalyticsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-3)] text-[var(--color-info)]">
            <SparkleIcon className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="info">AI Edge · beta</Badge>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Find value the book doesn&apos;t see</h1>
            <p className="mt-2 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Our model ingests xG, injuries, line movement, head-to-head, and meta context across 40+
              leagues. We surface mispriced odds and high-confidence picks updated every 5 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Insights */}
      <section className="mt-6">
        <SectionHeader title="Live insights" subtitle="Updated continuously · last sync 12s ago" Icon={ZapIcon} accent="var(--color-info)" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {insights.map((i) => (
            <div key={i.title} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
              <span
                className="mono inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${i.accent}1f`, color: i.accent }}
              >
                {i.tag}
              </span>
              <p className="mt-2 text-[14px] font-bold text-white">{i.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-3)]">{i.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Predictions */}
      <section className="mt-6">
        <SectionHeader
          title="Today's picks"
          subtitle="Ranked by expected value"
          Icon={FlameIcon}
          accent="var(--color-warn)"
          right={<span className="text-[11px] text-[var(--color-ink-3)]">Updated 5 min ago</span>}
        />
        <div className="grid gap-3 md:grid-cols-2">
          {predictions.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
              <div className="flex items-center justify-between border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-4 py-2.5">
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{p.league}</p>
                <div className="flex items-center gap-1.5">
                  {p.direction === "up" ? (
                    <TrendUp className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                  ) : (
                    <TrendDown className="h-3.5 w-3.5 text-[var(--color-live)]" />
                  )}
                  <span className="mono text-[11px] font-bold text-white">+{p.valueBps}% EV</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-[15px] font-bold text-white">{p.match}</p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex-1 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Model pick</p>
                    <p className="text-[14px] font-bold text-white">{p.pick}</p>
                  </div>
                  <div className="w-28 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Odds</p>
                    <p className="mono text-xl font-black text-[var(--color-brand-500)]">{p.odds.toFixed(2)}</p>
                    <p className="mono text-[10px] text-[var(--color-ink-4)]">fair {p.fair.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">Confidence</span>
                      <span className="mono text-[12px] font-bold text-white">{p.confidence}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${p.confidence}%`,
                          background:
                            p.confidence >= 75
                              ? "var(--color-brand-500)"
                              : p.confidence >= 65
                              ? "var(--color-warn)"
                              : "var(--color-ink-3)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-2)]">{p.reasoning}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.factors.map((f) => (
                    <span key={f} className="rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-ink-2)]">
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm">Add to slip</Button>
                  <Button size="sm" variant="outline">View match</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-3)]" />
        <p className="text-[11px] leading-relaxed text-[var(--color-ink-3)]">
          AI predictions are informational, not advice. Past model performance is not indicative of
          future returns. Always bet responsibly within means you can afford to lose.
        </p>
      </div>
    </div>
  );
}
