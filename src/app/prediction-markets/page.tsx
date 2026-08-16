import Link from "next/link";
import OddsButton from "@/components/sportsbook/OddsButton";
import { ZapIcon, ArrowUpRight } from "@/components/icons/UIIcons";
import type { MarketDTO } from "@/lib/types";
import { internalApiBase } from "@/lib/server/internalApiBase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prediction Markets — Trade Event Outcomes with Live Probabilities",
  description:
    "Trade real-time prediction market event outcomes on SportyStake. Binary and multi-outcome sports prediction markets with instant non-custodial USDC settlement.",
};

const MAX_SELECTIONS_SHOWN = 6;
// A technical ceiling, not a content cap — every open, not-yet-closed sports
// prediction market should show. Matches syncPolymarketMarkets's own upper
// bound (MAX_EVENT_PAGES * EVENTS_PAGE_SIZE in polymarket.ts, currently 800)
// so this read never becomes the binding constraint instead of the sync.
// syncPolymarketMarkets runs on oracle-sync.worker.ts's own schedule, not on
// this page's request path, and a filtered Postgres read stays fast at this
// size regardless.
const MAX_MARKETS_LISTED = 800;

function predictionBundle(market: MarketDTO) {
  return market.odds.find((bundle) => bundle.marketType === "binary" || bundle.marketType === "multi_outcome");
}

export default async function PredictionMarketsPage() {
  // Fetched via the API route (not queried directly here) so this page runs
  // unmodified on both the EC2 backend build and the Cloudflare Pages
  // frontend build — see src/app/page.tsx's matching comment.
  const res = await fetch(
    `${internalApiBase()}/api/markets?sport=prediction-markets&limit=${MAX_MARKETS_LISTED}`,
    { cache: "no-store" },
  );
  const { data } = (await res.json()) as { data: { items: MarketDTO[] } };
  const markets = data.items.filter((market) => predictionBundle(market)?.selections.length);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
        <div className="flex items-center gap-2 text-[var(--color-brand-500)]">
          <ZapIcon className="h-5 w-5" />
          <span className="text-[12px] font-bold uppercase tracking-wider">Prediction Markets</span>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">Trade event outcomes with live probabilities</h1>
        <p className="mt-3 max-w-2xl text-[14px] text-[var(--color-ink-2)] md:text-[15px]">
          Prediction markets are synced into SportyStake as native markets, so users can place and manage positions with the same betslip and account flow used for sports.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sportsbook"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-4 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
          >
            Open Sportsbook
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ai-analytics"
            className="inline-flex h-10 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
          >
            Explore AI Signals
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {markets.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 text-center text-[13px] text-[var(--color-ink-2)]">
            No active prediction markets are available right now.
          </div>
        ) : (
          markets.map((market) => {
            const bundle = predictionBundle(market);
            if (!bundle) return null;

            const question = typeof market.metadata?.question === "string" ? market.metadata.question : market.homeTeam;
            const description = typeof market.metadata?.description === "string" ? market.metadata.description : null;
            const externalUrl = typeof market.metadata?.externalUrl === "string" ? market.metadata.externalUrl : null;
            const rawEnd = typeof market.metadata?.endDate === "string" ? market.metadata.endDate : market.startTime;
            const volume = typeof market.metadata?.volume === "number" ? market.metadata.volume : 0;
            const end = new Date(rawEnd).toLocaleString();
            // Sorted by implied probability (lower decimal odds = more likely) so
            // a 30+ option market (e.g. an award-winner event) shows its most
            // relevant picks first rather than an arbitrary/sync-order slice.
            const topSelections = [...bundle.selections].sort((a, b) => a.valueX1000 - b.valueX1000);
            const shownSelections = topSelections.slice(0, MAX_SELECTIONS_SHOWN);
            const hiddenCount = topSelections.length - shownSelections.length;

            return (
              <div
                key={market.id}
                className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-500)]">
                      {bundle.marketType === "multi_outcome" ? `Sports · ${topSelections.length} options` : "Sports"}
                    </p>
                    <p className="mt-2 line-clamp-3 text-[15px] font-semibold text-white">{question}</p>
                  </div>
                  <Link href={`/sportsbook/match/${market.id}`} className="shrink-0 text-[12px] font-semibold text-[var(--color-brand-500)] hover:underline">
                    View
                  </Link>
                </div>
                {description && <p className="mt-3 line-clamp-3 text-[12px] text-[var(--color-ink-3)]">{description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-ink-3)]">
                  <span>Closes: {end}</span>
                  <span>Vol: {Math.round(volume).toLocaleString()}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {shownSelections.map((selection) => (
                    <OddsButton
                      key={`${market.id}-${selection.outcome}`}
                      matchId={market.id}
                      matchLabel={question}
                      market="Prediction"
                      selection={selection.label}
                      label={selection.label}
                      odds={selection.valueX1000 / 1000}
                    />
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <Link
                    href={`/sportsbook/match/${market.id}`}
                    className="mt-2 block text-center text-[11px] font-semibold text-[var(--color-ink-3)] hover:text-white"
                  >
                    +{hiddenCount} more option{hiddenCount === 1 ? "" : "s"}
                  </Link>
                )}
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-ink-3)]">Synced from Polymarket</span>
                  {externalUrl ? (
                    <a href={externalUrl} target="_blank" rel="noreferrer" className="text-[var(--color-ink-2)] hover:text-white">
                      Source
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
