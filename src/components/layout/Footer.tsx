import { LogoMark, ShieldIcon, UsdtIcon, UsdcIcon, EthIcon, BadgeCheck } from "@/components/icons/UIIcons";

const cols = [
  { title: "Sportsbook", links: ["Soccer", "Basketball", "Tennis", "Esports", "MMA", "Live betting"] },
  { title: "Casino", links: ["Slots", "Live Casino", "Crash", "Dice", "Blackjack", "Roulette"] },
  { title: "Earn", links: ["Liquidity Pools", "Referrals", "Affiliate", "SPRTY Token", "Airdrop"] },
  { title: "Company", links: ["About", "Careers", "Blog", "Press", "Brand kit"] },
  { title: "Support", links: ["Help center", "Security", "Status", "Terms", "Responsible gambling"] },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-[1.5fr_repeat(5,_1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <span className="text-base font-black tracking-tight">
                sporty<span className="text-[var(--color-brand-500)]">stake</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[var(--color-ink-3)]">
              The non-custodial crypto sportsbook & casino. Your keys. Your funds. Always.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <UsdtIcon className="h-6 w-6" />
              <UsdcIcon className="h-6 w-6" />
              <EthIcon className="h-6 w-6" />
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink-3)]">
              <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
              Audited by Certik · OpenZeppelin
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-4)]">
                {c.title}
              </p>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a className="text-[13px] text-[var(--color-ink-2)] hover:text-white" href="#">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-line-1)] pt-6 md:flex-row md:items-center">
          <p className="flex items-center gap-2 text-[12px] text-[var(--color-ink-4)]">
            <ShieldIcon className="h-3.5 w-3.5" />
            18+ · Gamble responsibly · Smart contracts on Arc · © {new Date().getFullYear()} SportyStake
          </p>
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)] pulse-dot" />
            <span className="text-[12px] font-semibold text-[var(--color-ink-1)]">Arc network · 18 ms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
