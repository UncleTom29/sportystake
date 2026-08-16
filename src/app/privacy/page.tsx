import Link from "next/link";
import { ShieldIcon, BadgeCheck, ZapIcon } from "@/components/icons/UIIcons";
import Badge from "@/components/ui/Badge";

export const metadata = {
  title: "Privacy Policy — SportyStake Non-Custodial Protocol",
  description: "Privacy policy for SportyStake non-custodial decentralized sportsbook, provably fair casino, and liquidity pool protocol.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-3 py-6 md:px-5">
      <header className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="bg-mesh absolute inset-0 opacity-60 pointer-events-none" />
        <div className="relative">
          <Badge variant="brand">Zero KYC & Non-Custodial Privacy</Badge>
          <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
            SportyStake operates as a fully decentralized, non-custodial Web3 protocol. We do not collect, store, or sell personal identification documents.
          </p>
          <p className="mt-3 text-[11px] text-[var(--color-ink-4)] mono">
            Last Updated: August 8, 2026 · Protocol Version 2.4 (Arc EVM Chain)
          </p>
        </div>
      </header>

      <article className="mt-8 space-y-6 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
        <section className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
            1. Zero Personal Data Collection (No KYC)
          </h2>
          <p>
            SportyStake does not require registration with name, email address, phone number, physical address, or government-issued ID. Account creation is executed entirely via cryptographic wallet signatures (Web3 wallets or Privy social logins).
          </p>
        </section>

        <section className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-[var(--color-info)]" />
            2. Public On-Chain Ledger Transparency
          </h2>
          <p>
            All smart contract transactions, sports bet placements, casino game resolutions, liquidity deposits, and payout claims are publicly immutably recorded on the Arc Network blockchain ledger. Public wallet addresses and transaction hashes are viewable via public block explorers.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-[var(--color-warn)]" />
            3. Local Storage & Cookies
          </h2>
          <p>
            We use minimal client-side <code className="mono text-white bg-[var(--color-bg-3)] px-1 rounded">localStorage</code> solely to remember local preferences (such as accepted terms & compliance acknowledgement and betslip state). We do not track users across third-party websites or deploy invasive advertising cookies.
          </p>
        </section>
      </article>
    </main>
  );
}
