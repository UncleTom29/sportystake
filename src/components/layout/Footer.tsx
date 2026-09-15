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
    title: "Markets & Social",
    links: [
      { label: "Prediction Markets", href: "/prediction-markets" },
      { label: "Market Analytics", href: "/ai-analytics" },
      { label: "Social Bet Feed", href: "/social" },
      { label: "Shared Tickets", href: "/sportsbook" },
      { label: "Lifetime Referral Program", href: "/profile" },
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
      {/* Top Banner: Web3 Trust & Security */}
      <div className="border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)]/60 py-6">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Instant Access</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Fast &amp; Secure Payouts</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/20">
                <ZapIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Fast Payouts</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Direct USDC Settlements</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-info)]/10 text-[var(--color-info)] border border-[var(--color-info)]/20">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Provably Fair</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Transparent Odds &amp; History</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Guaranteed Solvency</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">100% Reserve Backed</p>
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
              The premier modern sportsbook and casino. Enjoy instant USDC payouts, competitive global odds across 40+ sports, and provably fair casino games with zero delays.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Settlement Asset:</span>
              <div className="flex items-center gap-2 bg-[var(--color-bg-2)] px-3 py-1.5 rounded-lg border border-[var(--color-line-1)]">
                <UsdcIcon className="h-4.5 w-4.5" />
                <span className="mono text-[11px] font-bold text-white">USDC</span>
                <span className="rounded bg-[var(--color-brand-500)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/30">
                  FAST &amp; SECURE
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--color-ink-3)] pt-1">
              <ShieldIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Audited Security · 100% Reserve Backed</span>
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
                Terms &amp; Conditions
              </Link>
              <span>·</span>
              <span>© {new Date().getFullYear()} SportyStake</span>
            </p>
            <p className="text-[10px] text-[var(--color-ink-4)] max-w-3xl">
              SportyStake is an online sports entertainment and gaming platform. Users must be 18+ and are solely responsible for ensuring compliance with their local legal jurisdiction. Gamble responsibly.
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
            <div className="text-[11px]">
              <span className="font-bold text-white block">Arc Network</span>
              <span className="mono text-[10px] text-[var(--color-ink-3)]">Operational · 99.9% Uptime</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
