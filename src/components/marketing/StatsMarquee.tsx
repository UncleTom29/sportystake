import { ZapIcon, TrophyIcon, FlameIcon, LiveIcon, ShieldIcon, BadgeCheck, GiftIcon } from "@/components/icons/UIIcons";

export interface StatsMarqueeProps {
  totalWagered?: string;
  openMarkets?: string | number;
  todayMarkets?: string | number;
  activeWallets?: string | number;
  maxWin?: string;
}

export default function StatsMarquee({
  totalWagered,
  openMarkets,
  todayMarkets,
  activeWallets = "—",
  maxWin = "—",
}: StatsMarqueeProps) {
  const items = [
    { Icon: ShieldIcon, label: "100% Non-Custodial", sub: "smart contract escrow" },
    { Icon: ZapIcon, label: "Zero KYC", sub: "1-click instant web3 auth" },
    { Icon: ZapIcon, label: "Sub-Second", sub: "automated on-chain payouts" },
    { Icon: BadgeCheck, label: "Provably Fair", sub: "SHA-256 commit-reveal hashing" },
    { Icon: GiftIcon, label: "$2,000 Bonus", sub: "100% first-wager match" },
    { Icon: FlameIcon, label: "Prediction Markets", sub: "global real-world events" },
    { Icon: BadgeCheck, label: "Arc EVM Chain", sub: "18ms transaction finality" },
    ...(maxWin && maxWin !== "—" ? [{ Icon: TrophyIcon, label: maxWin, sub: "biggest win this week" }] : []),
  ];

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
