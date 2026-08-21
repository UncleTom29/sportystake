import Link from "next/link";
import { ShieldIcon, BadgeCheck, ZapIcon, GiftIcon, TicketIcon, ArrowUpRight } from "@/components/icons/UIIcons";
import Badge from "@/components/ui/Badge";

export const metadata = {
  title: "Terms & Conditions — SportyStake",
  description: "Comprehensive Terms & Conditions for SportyStake non-custodial sportsbook, provably fair casino, and liquidity pool protocol.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-3 py-6 md:px-5">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="bg-mesh absolute inset-0 opacity-60" />
        <div className="relative">
          <Badge variant="brand">Legal & Protocol Agreement</Badge>
          <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
            Terms & Conditions
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
            Please read these Terms & Conditions carefully before interacting with SportyStake smart contracts, placing wagers, creating referral links, or depositing into liquidity pools.
          </p>
          <p className="mt-3 text-[11px] text-[var(--color-ink-4)] mono">
            Last Updated: August 7, 2026 · Protocol Version 2.4 (Arc EVM Chain)
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Table of Contents Sticky Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mb-3">
              Table of Contents
            </p>
            <nav className="space-y-1.5 text-[12px]">
              <a href="#section-1" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                1. Acceptance of Terms & Protocol Nature
              </a>
              <a href="#section-2" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                2. Non-Custodial & Zero-KYC Policy
              </a>
              <a href="#section-3" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                3. Promotional Terms & Bonus Rules
              </a>
              <a href="#section-4" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                4. Provably Fair Casino & Hash Verifier
              </a>
              <a href="#section-5" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                5. Liquidity Pools & "Be The House"
              </a>
              <a href="#section-6" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                6. Smart Contract Execution & Payouts
              </a>
              <a href="#section-7" className="block text-[var(--color-ink-2)] hover:text-white transition-colors py-1">
                7. Disclaimers & Risk Disclosures
              </a>
            </nav>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          {/* Section 1 */}
          <section id="section-1" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-[var(--color-brand-500)]">01.</span>
              Acceptance of Terms & Protocol Nature
            </h2>
            <p>
              SportyStake is a decentralized, non-custodial Web3 application operating on the Arc EVM blockchain. By connecting a self-custodial cryptocurrency wallet (e.g. MetaMask, Coinbase Wallet, Privy Embedded Wallet) or interacting with SportyStake smart contracts, you agree to be bound by these Terms & Conditions.
            </p>
            <p className="mt-3">
              If you do not agree to all terms herein, you must refrain from interacting with the smart contracts or placing wagers.
            </p>
          </section>

          {/* Section 2 */}
          <section id="section-2" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-cyan-400">02.</span>
              Non-Custodial Escrow & Zero-KYC Policy
            </h2>
            <div className="space-y-3">
              <p>
                <strong>Self-Custodial Protocol:</strong> SportyStake does not act as a custodian, bank, or centralized exchange. Your crypto assets remain under your direct control at all times via your public wallet address.
              </p>
              <p>
                <strong>Zero KYC Verification:</strong> Access to the protocol is permissionless and executed directly via EVM wallet signatures. No personal identity documents, passports, or utility bills are stored or required by the protocol.
              </p>
              <p>
                <strong>Compliance Responsibility:</strong> Users are solely responsible for ensuring that participating in decentralized wagering and liquidity provision complies with all applicable local laws in their respective jurisdiction.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="section-3" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="mono text-sm text-emerald-400">03.</span>
              Promotions, Bonus Rules & Affiliate Terms
            </h2>

            <div className="space-y-5">
              {/* Promo 1: Welcome Bonus */}
              <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
                <div className="flex items-center gap-2">
                  <GiftIcon className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-[14px]">A. $2,000 Welcome First-Wager Match Bonus</h3>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] list-disc list-inside text-[var(--color-ink-3)]">
                  <li>Applies exclusively to a user&apos;s first settled wager placed on-chain.</li>
                  <li>Eligible users receive a 100% bonus match up to $2,000 USDC.</li>
                  <li>Bonus rewards are subject to a 1x wagering settlement requirement before withdrawal.</li>
                  <li>Limited to one (1) Welcome Bonus per unique Web3 wallet address.</li>
                </ul>
              </div>

              {/* Promo 2: Lifetime Referrals */}
              <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
                <div className="flex items-center gap-2">
                  <TicketIcon className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-bold text-white text-[14px]">B. Lifetime Referral Program</h3>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] list-disc list-inside text-[var(--color-ink-3)]">
                  <li>Referrers receive a perpetual cut of up to 25% of house margin generated by referred wallet addresses.</li>
                  <li>Referral links track wallet addresses permanently upon initial smart contract interaction.</li>
                  <li>No cap on lifetime earnings per referrer. Rewards are distributed automatically on-chain.</li>
                </ul>
              </div>

              {/* Promo 3: Shared Ticket Copy Bets */}
              <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
                <div className="flex items-center gap-2">
                  <ZapIcon className="h-4 w-4 text-amber-400" />
                  <h3 className="font-bold text-white text-[14px]">C. Shared Ticket Affiliate Program</h3>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] list-disc list-inside text-[var(--color-ink-3)]">
                  <li>Users sharing bet tickets (e.g. ST-7X9K2) earn a 2% volume commission on all copied wagers.</li>
                  <li>Commissions accrue automatically whenever another user inputs or copies the ticket code.</li>
                  <li>Commission payouts settle directly in USDC into the referrer&apos;s wallet.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="section-4" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-violet-300">04.</span>
              Provably Fair Casino & Commit-Reveal Hashing
            </h2>
            <p>
              All SportyStake Casino Original games (Aviator, Dice, Slots, Roulette, Blackjack, Baccarat) utilize cryptographic SHA-256 commit-reveal seed hashing.
            </p>
            <div className="mt-3 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 space-y-2 text-[12px]">
              <p><strong>Pre-committed Hash:</strong> The server seed hash is published prior to bet placement. The server cannot alter the seed after your bet is placed.</p>
              <p><strong>Client Seed:</strong> Users may supply their own custom seed or rely on browser-generated random entropy.</p>
              <p><strong>Deterministic Verification:</strong> `HMAC_SHA256(ServerSeed, ClientSeed + Nonce)` produces the exact game outcome. Anyone can verify outcome fairness in real time.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section-5" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-amber-400">05.</span>
              Liquidity Pools & "Be The House" Terms (Up to 22,000% APY)
            </h2>
            <p>
              Users may deposit USDC into the shared non-custodial `LiquidityPool` to act as the protocol house.
            </p>
            <ul className="mt-3 space-y-1.5 list-disc list-inside text-[12px] text-[var(--color-ink-3)]">
              <li><strong>Yield Generation:</strong> Yield (up to 22,000% APY) is derived from actual sportsbook & casino wager margins. Yield is variable and fluctuates based on volume.</li>
              <li><strong>Risk Disclosure:</strong> LP depositors share in house profit and house loss. Capital loss is possible if players experience a statistically positive winning streak.</li>
              <li><strong>Timelock Exit:</strong> LP withdrawals require a 48-hour request timelock to ensure vault solvency and prevent bank-run exits during active events.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="section-6" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-emerald-400">06.</span>
              Smart Contract Execution & Sub-Second Settlement
            </h2>
            <p>
              Wager settlement is handled autonomously by smart contracts deployed on the Arc EVM blockchain. Average block finality is 18ms. Payouts are transferred automatically to winning wallets upon oracle settlement verification.
            </p>
          </section>

          {/* Section 7 */}
          <section id="section-7" className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-md">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="mono text-sm text-rose-400">07.</span>
              Disclaimers & Limitation of Liability
            </h2>
            <p>
              SportyStake smart contracts are provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. The protocol developers, operators, and contributors assume no liability for loss of funds due to user error, lost private keys, blockchain network congestion, or third-party RPC outages.
            </p>
          </section>

          {/* Footer CTA */}
          <div className="rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-6 text-center shadow-xl">
            <h3 className="text-lg font-bold text-white">Have questions regarding protocol terms?</h3>
            <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
              Check our on-chain pools or connect with the community.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/ai-analytics"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-500)] px-4 text-[12px] font-bold text-black hover:bg-[var(--color-brand-400)]"
              >
                AI Analytics
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/sportsbook"
                className="inline-flex h-9 items-center rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
              >
                Explore Sportsbook
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
