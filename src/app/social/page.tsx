import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import { FlameIcon, TrophyIcon, BadgeCheck, CopyIcon, ChevronRight, HeartIcon } from "@/components/icons/UIIcons";

const topBettors = [
  { rank: 1, handle: "CryptoTipster.eth", color: "#f59e0b", followers: 4820, winRate: 67.2, roi: 22.4, streak: 8, verified: true },
  { rank: 2, handle: "GoalMachine99", color: "#22c55e", followers: 2940, winRate: 61.5, roi: 18.1, streak: 5 },
  { rank: 3, handle: "OddsWizard.arc", color: "#8b5cf6", followers: 1870, winRate: 59.8, roi: 14.8, streak: 3 },
  { rank: 4, handle: "SlateBreaker", color: "#06b6d4", followers: 1240, winRate: 58.3, roi: 11.2, streak: 0 },
  { rank: 5, handle: "QuantBet_", color: "#f43f5e", followers: 980, winRate: 56.7, roi: 9.8, streak: 4 },
];

const publicSlips = [
  {
    id: "ps1",
    user: "CryptoTipster.eth",
    color: "#f59e0b",
    time: "2h ago",
    selections: [
      { match: "Arsenal vs Man City", pick: "Arsenal Win", odds: 2.85 },
      { match: "Real Madrid vs Barça", pick: "Over 2.5", odds: 1.80 },
    ],
    stake: 100,
    status: "open" as const,
    copies: 142,
    likes: 318,
  },
  {
    id: "ps2",
    user: "GoalMachine99",
    color: "#22c55e",
    time: "4h ago",
    selections: [{ match: "Bayern vs Dortmund", pick: "Bayern Win", odds: 1.65 }],
    stake: 50,
    status: "won" as const,
    copies: 89,
    likes: 204,
    result: "+32.50 USDT",
  },
  {
    id: "ps3",
    user: "OddsWizard.arc",
    color: "#8b5cf6",
    time: "6h ago",
    selections: [
      { match: "Chelsea vs Liverpool", pick: "Draw", odds: 3.20 },
      { match: "Inter vs Milan", pick: "Inter Win", odds: 2.30 },
      { match: "Lakers vs Celtics", pick: "Over 221.5", odds: 1.90 },
    ],
    stake: 30,
    status: "open" as const,
    copies: 67,
    likes: 142,
  },
];

export default function SocialPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative">
          <Badge variant="violet">Social betting</Badge>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Tail the sharpest wallets</h1>
          <p className="mt-2 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
            Follow top bettors, copy their picks one-tap, compete on a fully verifiable on-chain
            leaderboard. Every record is signed by the user&apos;s wallet.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionHeader title="Public slips" subtitle="Verified bets — wallet-signed" Icon={FlameIcon} accent="var(--color-warn)" />
          <div className="space-y-3">
            {publicSlips.map((s) => {
              const parlay = s.selections.reduce((acc, sel) => acc * sel.odds, 1);
              return (
                <div key={s.id} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar color={s.color} initials={s.user.slice(0, 2).toUpperCase()} />
                      <div>
                        <p className="text-[13px] font-bold text-white">{s.user}</p>
                        <p className="text-[11px] text-[var(--color-ink-3)]">{s.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === "won" ? (
                        <Badge variant="brand">Won</Badge>
                      ) : (
                        <Badge variant="neutral">Open</Badge>
                      )}
                      {s.result && <span className="mono text-[13px] font-bold text-[var(--color-brand-500)]">{s.result}</span>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {s.selections.map((sel, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-[var(--color-bg-1)] px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--color-ink-3)]">{sel.match}</p>
                          <p className="truncate text-[13px] font-semibold text-white">{sel.pick}</p>
                        </div>
                        <span className="mono shrink-0 text-[14px] font-bold text-[var(--color-brand-500)]">
                          {sel.odds.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-3 text-[var(--color-ink-3)]">
                      <span>
                        Stake <span className="mono font-bold text-white">{s.stake} USDT</span>
                      </span>
                      {s.selections.length > 1 && (
                        <span>
                          Multi <span className="mono font-bold text-[var(--color-warn)]">{parlay.toFixed(2)}×</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <HeartIcon className="h-3 w-3" /> {s.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <CopyIcon className="h-3 w-3" /> {s.copies}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">Copy</Button>
                      <Button size="sm">Tail bet</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeader title="Top bettors" subtitle="Last 30 days" Icon={TrophyIcon} accent="var(--color-warn)" />
          <div className="space-y-2">
            {topBettors.map((b) => (
              <div key={b.rank} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="mono flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[11px] font-black text-white">
                    #{b.rank}
                  </div>
                  <Avatar color={b.color} initials={b.handle.slice(0, 2).toUpperCase()} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-[13px] font-bold text-white">{b.handle}</p>
                      {b.verified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-info)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--color-ink-3)]">{b.followers.toLocaleString()} followers</p>
                  </div>
                  <Button size="sm" variant="outline">Follow</Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Stat label="Win" value={`${b.winRate}%`} accent="var(--color-brand-500)" />
                  <Stat label="ROI" value={`+${b.roi}%`} accent="var(--color-info)" />
                  <Stat label="Streak" value={`${b.streak}`} accent="var(--color-warn)" />
                </div>
              </div>
            ))}
            <button className="flex w-full items-center justify-between rounded-md bg-[var(--color-bg-2)] px-3 py-2 text-[12px] text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)]">
              See full leaderboard
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ color, initials }: { color: string; initials: string }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
    >
      {initials}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md bg-[var(--color-bg-1)] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono text-[13px] font-black" style={{ color: accent }}>{value}</p>
    </div>
  );
}
