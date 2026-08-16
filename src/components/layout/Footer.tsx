import Link from "next/link";
import {
  LogoMark,
  ShieldIcon,
  UsdcIcon,
  BadgeCheck,
  ZapIcon,
  ArrowUpRight,
} from "@/components/icons/UIIcons";

const footerNavigation = [
  {
    title: "Sportsbook",
    links: [
      { label: "Live In-Play Betting", href: "/sportsbook?live=1" },
      { label: "Top Football / Soccer", href: "/sportsbook?sport=football" },
      { label: "Basketball (NBA)", href: "/sportsbook?sport=basketball" },
      { label: "Tennis (ATP/WTA)", href: "/sportsbook?sport=tennis" },
      { label: "Esports & Gaming", href: "/sportsbook?sport=esports" },
      { label: "MMA / UFC", href: "/sportsbook?sport=mma" },
      { label: "Parlays & Bet Builder", href: "/sportsbook" },
    ],
  },
  {
    title: "Casino Originals",
    links: [
      { label: "Aviator (Crash)", href: "/casino/crash" },
      { label: "Provably Fair Dice", href: "/casino/dice" },
      { label: "Original Slots", href: "/casino/slots" },
      { label: "Roulette 3D", href: "/casino/roulette" },
      { label: "Blackjack Pro", href: "/casino/blackjack" },
      { label: "Baccarat Squeeze", href: "/casino/baccarat" },
      { label: "SHA-256 Hash Verifier", href: "/casino/crash" },
    ],
  },
  {
    title: "Earn & Liquidity",
    links: [
      { label: "Be The House (LP Pools)", href: "/pools" },
      { label: "Protocol Solvency Vault", href: "/pools" },
      { label: "My LP Positions", href: "/pools/my-positions" },
      { label: "Shared Ticket Affiliate", href: "/sportsbook" },
      { label: "Lifetime Referral Program", href: "/profile" },
      { label: "Yield Calculator (22,000% APY)", href: "/pools" },
    ],
  },
  {
    title: "Legal & Protocol",
    links: [
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Zero-KYC Policy", href: "/terms#section-2" },
      { label: "Risk & Solvency Disclosures", href: "/terms#section-7" },
      { label: "Provably Fair Documentation", href: "/terms#section-4" },
      { label: "Responsible Gaming", href: "/terms" },
      { label: "Admin Risk Control", href: "/admin" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
      {/* Top Banner: Protocol Solvency & Web3 Security */}
      <div className="border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)]/60 py-6">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">No KYC & Non-Custodial</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">100% Smart Contract Escrow</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/20">
                <ZapIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Sub-Second Payouts</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">18ms Arc Block Finality</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Provably Fair</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">SHA-256 Commit-Reveal Hashes</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ZapIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Be The House</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Up to 22,000% LP APY</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_repeat(4,_1fr)]">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark className="h-9 w-9 text-[var(--color-brand-500)]" />
              <span className="text-xl font-black tracking-tight text-white">
                sporty<span className="text-[var(--color-brand-500)]">stake</span>
              </span>
            </Link>

            <p className="max-w-sm text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              The premier non-custodial crypto sportsbook & provably fair casino protocol. Built natively on Arc EVM chain for zero-KYC instant execution, permissionless LP pools, and cryptographic outcome verification.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Settlement Asset:</span>
              <div className="flex items-center gap-2 bg-[var(--color-bg-2)] px-3 py-1.5 rounded-lg border border-[var(--color-line-1)]">
                <UsdcIcon className="h-4.5 w-4.5" />
                <span className="mono text-[11px] font-bold text-white">USDC</span>
                <span className="rounded bg-[var(--color-brand-500)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/30">
                  ARC NATIVE
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--color-ink-3)] pt-1">
              <ShieldIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Smart Contracts Audited · Non-Custodial Protocol</span>
            </div>
          </div>

          {/* Navigation Columns */}
          {footerNavigation.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                {col.title}
              </h4>
              <ul className="space-y-2 text-[13px]">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[var(--color-ink-2)] hover:text-white transition-colors flex items-center gap-1 group"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[var(--color-brand-500)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Disclaimer & Legal Bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-line-1)] pt-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                18+ ONLY
              </span>
              <span>Gamble Responsibly</span>
              <span>·</span>
              <Link href="/terms" className="underline hover:text-white font-medium">
                Terms & Conditions
              </Link>
              <span>·</span>
              <span>© {new Date().getFullYear()} SportyStake Protocol</span>
            </p>
            <p className="text-[10px] text-[var(--color-ink-4)] max-w-3xl">
              SportyStake is a non-custodial smart contract system operating natively on the Arc EVM network. Users are solely responsible for ensuring compliance with their local legal jurisdiction.
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
            <div className="text-[11px]">
              <span className="font-bold text-white block">Arc EVM Chain</span>
              <span className="mono text-[10px] text-[var(--color-ink-3)]">18ms Finality · ID 1337</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
