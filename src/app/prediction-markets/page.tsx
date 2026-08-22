import Link from "next/link";
import { ArrowUpRight } from "@/components/icons/UIIcons";
import { TrendingUp, Bot, ShieldCheck, CheckCircle2 } from "lucide-react";
import PredictionMarketsDashboard from "@/components/prediction-markets/PredictionMarketsDashboard";
import type { MarketDTO } from "@/lib/types";
import { internalApiBase } from "@/lib/server/internalApiBase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prediction Markets — Trade Global Event Probabilities",
  description:
    "Trade real-time prediction market event outcomes on SportyStake. Binary and multi-outcome sports, crypto, and world prediction markets with instant non-custodial USDC settlement.",
};

const MAX_MARKETS_LISTED = 800;

export default async function PredictionMarketsPage() {
  const res = await fetch(
    `${internalApiBase()}/api/markets?sport=prediction-markets&limit=${MAX_MARKETS_LISTED}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as { data?: { items?: MarketDTO[] } };
  const markets = json?.data?.items || [];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 md:px-6">
      {/* Hero Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,231,1,0.1),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="mono flex items-center gap-1.5 rounded-full bg-[var(--color-brand-500)]/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                <TrendingUp className="h-3.5 w-3.5" />
                Live Prediction Markets
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-live)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-live)] animate-pulse" />
                Live Odds
              </span>
            </div>

            <h1 className="mt-3.5 text-3xl font-black tracking-tight text-white md:text-4xl">
              Trade Event Outcomes with Real-Time Probabilities
            </h1>
            <p className="mt-2.5 text-[14px] text-[var(--color-ink-2)] md:text-[15px] leading-relaxed">
              Take positions on sports props, tournament champions, esports, and global milestones. Fully integrated with your universal SportyStake betslip and smart contract settlement.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-[var(--color-ink-3)]">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-[var(--color-brand-500)]" />
                Smart Contract Verified
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-500)]" />
                Instant USDC Settlement
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/sportsbook"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] px-4 text-[13px] font-bold text-[var(--color-bg-0)] shadow-lg shadow-[var(--color-brand-500)]/20 transition-all hover:bg-[var(--color-brand-400)]"
            >
              Sportsbook Lines
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ai-analytics"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-bg-3)]"
            >
              <Bot className="h-4 w-4 text-[var(--color-brand-500)]" />
              AI Value Signals
            </Link>
          </div>
        </div>
      </div>

      {/* Main Interactive Dashboard */}
      <PredictionMarketsDashboard initialMarkets={markets} />
    </div>
  );
}
