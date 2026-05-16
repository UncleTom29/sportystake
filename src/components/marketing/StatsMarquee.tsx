import { ZapIcon, TrophyIcon, FlameIcon, SparkleIcon, LiveIcon } from "@/components/icons/UIIcons";

const items = [
  { Icon: ZapIcon, label: "$124.8M", sub: "total wagered" },
  { Icon: LiveIcon, label: "248", sub: "live markets" },
  { Icon: FlameIcon, label: "+18.4%", sub: "best LP APY" },
  { Icon: TrophyIcon, label: "12,400", sub: "open events" },
  { Icon: SparkleIcon, label: "48,204", sub: "active wallets" },
  { Icon: ZapIcon, label: "$1.8M", sub: "biggest win this week" },
];

export default function StatsMarquee() {
  const list = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-[var(--color-line-1)] bg-[var(--color-bg-1)]/40">
      <div className="marquee-track flex w-max items-center gap-10 py-2.5 px-4">
        {list.map(({ Icon, label, sub }, i) => (
          <div key={i} className="flex shrink-0 items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
            <span className="mono text-[12px] font-bold text-white">{label}</span>
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{sub}</span>
            <span className="mx-2 h-1 w-1 rounded-full bg-[var(--color-ink-4)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
