import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import { TrophyIcon, GiftIcon, FlameIcon } from "@/components/icons/UIIcons";
import { SoccerIcon, BasketballIcon, GlobeIcon } from "@/components/icons/SportIcons";

const contests = [
  { id: "f1", name: "EPL Weekend Classic", sportLabel: "Premier League · Soccer", Icon: SoccerIcon, prize: "$5,000", entries: 842, maxEntries: 1000, entryFee: "$5", closes: "Sat · 14:00", type: "tournament" },
  { id: "f2", name: "NBA Daily Showdown", sportLabel: "NBA · Basketball", Icon: BasketballIcon, prize: "$2,500", entries: 320, maxEntries: 500, entryFee: "$10", closes: "Today · 23:00", type: "tournament" },
  { id: "f3", name: "Mega Jackpot Round", sportLabel: "Multi-league", Icon: GlobeIcon, prize: "$25,000", entries: 12840, maxEntries: 50000, entryFee: "$2", closes: "Sun · 16:00", type: "mega" },
  { id: "f4", name: "Free Roll Sunday", sportLabel: "Multi-sport", Icon: GlobeIcon, prize: "$500", entries: 2041, maxEntries: 5000, entryFee: "FREE", closes: "Sun · 12:00", type: "free" },
];

const leaderboard = [
  { rank: 1, user: "crypto_king.eth", points: 284, prize: "$500" },
  { rank: 2, user: "BetWizard99", points: 271, prize: "$250" },
  { rank: 3, user: "MoonBettor", points: 265, prize: "$100" },
  { rank: 4, user: "You", points: 241, prize: "$50", isMe: true },
  { rank: 5, user: "Zeroday.arc", points: 239, prize: "$25" },
];

export default function FantasyPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative grid items-center gap-4 md:grid-cols-[1.5fr_1fr]">
          <div>
            <Badge variant="warn">Fantasy · Daily contests</Badge>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Build a roster. Win the pot.</h1>
            <p className="mt-2 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Pick athletes inside a salary cap. Score points from real-world stats. Top finishers
              split the pool — paid out in stablecoins, instant.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button>Create lineup</Button>
              <Button variant="outline">My contests</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Live pools" value="14" accent="var(--color-brand-500)" />
            <Stat label="Top prize" value="$25K" accent="var(--color-warn)" />
            <Stat label="Players" value="48k" accent="var(--color-info)" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          { step: "1", title: "Pick players", desc: "Select athletes from today's fixtures within your $50K cap." },
          { step: "2", title: "Enter a contest", desc: "Public tournaments or private rooms with friends." },
          { step: "3", title: "Win crypto", desc: "Earn points from real stats. Top scorers split the pool." },
        ].map((s) => (
          <div key={s.step} className="flex gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <div className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-warn)]/15 text-[var(--color-warn)]">
              {s.step}
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">{s.title}</p>
              <p className="text-[12px] text-[var(--color-ink-3)]">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionHeader title="Open contests" Icon={FlameIcon} accent="var(--color-warn)" />
          <div className="space-y-3">
            {contests.map((c) => {
              const fill = (c.entries / c.maxEntries) * 100;
              return (
                <div key={c.id} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-warn)]">
                        <c.Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          {c.type === "mega" && <Badge variant="warn">MEGA</Badge>}
                          {c.type === "free" && <Badge variant="brand">FREE</Badge>}
                          <p className="text-[11px] text-[var(--color-ink-3)]">{c.sportLabel}</p>
                        </div>
                        <p className="truncate text-[14px] font-bold text-white">{c.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="mono text-xl font-black text-[var(--color-warn)]">{c.prize}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Prize</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-[var(--color-ink-3)]">
                      <span className="mono">
                        {c.entries.toLocaleString()} / {c.maxEntries.toLocaleString()}
                      </span>
                      <span className="mono">Closes {c.closes}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${fill}%`,
                          background: "linear-gradient(90deg, var(--color-warn), var(--color-brand-500))",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="mono text-[12px] font-bold text-white">{c.entryFee} entry</span>
                    <Button size="sm">Enter contest</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeader title="Weekly leaderboard" Icon={TrophyIcon} accent="var(--color-warn)" />
          <div className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
            {leaderboard.map((e) => (
              <div
                key={e.rank}
                className={`flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-2.5 last:border-b-0 ${
                  e.isMe ? "bg-[var(--color-brand-500)]/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`mono flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-black ${
                      e.rank === 1
                        ? "bg-[var(--color-warn)] text-[var(--color-bg-0)]"
                        : e.rank === 2
                        ? "bg-[var(--color-ink-2)] text-[var(--color-bg-0)]"
                        : e.rank === 3
                        ? "bg-[#cd7f32] text-[var(--color-bg-0)]"
                        : "bg-[var(--color-bg-3)] text-white"
                    }`}
                  >
                    {e.rank}
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${e.isMe ? "text-[var(--color-brand-500)]" : "text-white"}`}>
                      {e.user}
                      {e.isMe && <span className="ml-1 text-[10px] text-[var(--color-brand-500)]">(you)</span>}
                    </p>
                    <p className="mono text-[10px] text-[var(--color-ink-3)]">{e.points} pts</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <GiftIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                  <span className="mono text-[12px] font-bold text-[var(--color-brand-500)]">{e.prize}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-[var(--color-ink-4)]">Resets every Sunday 00:00 UTC</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 text-center">
      <p className="mono text-xl font-black" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
    </div>
  );
}
