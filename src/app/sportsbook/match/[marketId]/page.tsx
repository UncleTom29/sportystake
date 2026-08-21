"use client";
import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Markets } from "@/lib/api-client";
import { marketToMatch } from "@/lib/adapters/marketToMatch";
import type { Match } from "@/lib/mockData";
import type { MarketDTO, OddsBundle } from "@/lib/types";
import OddsButton from "@/components/sportsbook/OddsButton";
import {
  ChevronLeft, LiveIcon, ShieldIcon, ZapIcon,
} from "@/components/icons/UIIcons";

interface MarketRow {
  label: string;
  selections: { label: string; outcome: number; odds: number }[];
}
interface MarketSection {
  id: string;
  label: string;
  rows: MarketRow[];
}

/** Build market sections from real OddsBundle data the oracle has captured. */
function buildMarkets(odds: OddsBundle[]): MarketSection[] {
  function findBundle(type: string): OddsBundle | undefined {
    return odds.find((o) => o.marketType === type);
  }
  function selsFor(type: string): MarketRow["selections"] {
    const b = findBundle(type);
    if (!b) return [];
    return b.selections.map((s) => ({
      label: s.label,
      outcome: s.outcome,
      odds: s.valueX1000 / 1000,
    }));
  }

  const out: MarketSection[] = [];

  const binary = selsFor("binary");
  if (binary.length > 0) {
    out.push({
      id: "binary",
      label: "Prediction",
      rows: [{ label: "Outcome", selections: binary }],
    });
  }

  const oneX2 = selsFor("1X2");
  if (oneX2.length > 0) {
    out.push({
      id: "1X2",
      label: "Match Result",
      rows: [{ label: "1X2", selections: oneX2 }],
    });
  }

  // Over / Under — collect ALL over_under_* market types, sort by line value.
  // Key encoding: line × 10, stored as integer (e.g. 0.5→5, 2.5→25, 3.0→30, 47.5→475)
  const ouLineVal = (key: string) => parseInt(key.replace("over_under_", ""), 10) / 10;
  const allOuTypes = [...new Set(
    odds.filter((o) => o.marketType.startsWith("over_under_")).map((o) => o.marketType),
  )].sort((a, b) => ouLineVal(a) - ouLineVal(b));
  const ouRows: MarketRow[] = [];
  for (const lineType of allOuTypes) {
    const sels = selsFor(lineType);
    if (sels.length === 0) continue;
    const lineNum = ouLineVal(lineType);
    const numStr = lineNum % 1 === 0 ? `${lineNum}.0` : lineNum.toFixed(1);
    const lineLabel = lineNum <= 15 ? `Goals ${numStr}` : `Total ${numStr}`;
    ouRows.push({ label: lineLabel, selections: sels });
  }
  if (ouRows.length > 0) out.push({ id: "over_under", label: "Over / Under", rows: ouRows });

  const btts = selsFor("btts");
  if (btts.length > 0) {
    out.push({ id: "btts", label: "Both Teams to Score", rows: [{ label: "BTTS", selections: btts }] });
  }

  const dc = selsFor("double_chance");
  if (dc.length > 0) {
    out.push({ id: "double_chance", label: "Double Chance", rows: [{ label: "Double Chance", selections: dc }] });
  }

  const dnb = selsFor("draw_no_bet");
  if (dnb.length > 0) {
    out.push({ id: "draw_no_bet", label: "Draw No Bet", rows: [{ label: "Draw No Bet", selections: dnb }] });
  }

  const ht = selsFor("half_time_result");
  if (ht.length > 0) {
    out.push({ id: "half_time", label: "Half-Time Result", rows: [{ label: "Half Time", selections: ht }] });
  }

  // Asian Handicap — one entry per line (e.g. asian_handicap_-15 = −1.5)
  const ahTypes = [...new Set(
    odds.filter((o) => o.marketType.startsWith("asian_handicap_")).map((o) => o.marketType),
  )].sort((a, b) => {
    const parse = (k: string) => parseFloat(k.replace("asian_handicap_", "").replace(/(\d)(\d)$/, "$1.$2"));
    return parse(a) - parse(b);
  });
  const ahRows: MarketRow[] = [];
  for (const ahType of ahTypes) {
    const sels = selsFor(ahType);
    if (sels.length === 0) continue;
    const raw = ahType.replace("asian_handicap_", "");
    const lineLabel = raw.replace(/(-?)(\d)(\d)$/, "$1$2.$3") || raw;
    ahRows.push({ label: `Handicap ${lineLabel}`, selections: sels });
  }
  if (ahRows.length > 0) out.push({ id: "asian_handicap", label: "Asian Handicap", rows: ahRows });

  return out;
}

export default function MatchDetailPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const [market, setMarket] = useState<MarketDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("1X2");
  const [nowTs, setNowTs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Markets.detail(marketId)
      .then((m) => {
        if (cancelled) return;
        setMarket(m);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message ?? "Failed to load market"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [marketId]);

  useEffect(() => {
    setNowTs(Date.now());
  }, [market?.id, market?.startTime, market?.status]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-3 py-20 text-center text-[13px] text-[var(--color-ink-3)]">
        Loading match…
      </div>
    );
  }
  if (error?.toLowerCase().includes("not found")) {
    notFound();
  }
  if (error || !market) {
    return (
      <div className="mx-auto max-w-[1400px] px-3 py-20 text-center">
        <p className="text-[15px] font-bold text-[var(--color-live)]">Failed to load match</p>
        <p className="mt-1 text-[13px] text-[var(--color-ink-3)]">{error ?? "Unknown error"}</p>
        <Link href="/sportsbook" className="mt-4 inline-block text-[12px] text-[var(--color-brand-500)] hover:underline">
          ← Back to sportsbook
        </Link>
      </div>
    );
  }

  const matchUi: Match = marketToMatch(market);
  const markets = buildMarkets(market.odds ?? []);
  const activeMarket = markets.find((m) => m.id === tab) ?? markets[0];
  const question = typeof market.metadata?.question === "string" ? market.metadata.question : null;
  const isPrediction = market.sport === "prediction-markets" || Boolean(question);
  const backHref = isPrediction ? "/prediction-markets" : "/sportsbook";
  const backLabel = isPrediction ? "Prediction Markets" : "Sportsbook";
  const title = question ?? `${market.homeTeam} vs ${market.awayTeam}`;
  const category = typeof market.metadata?.category === "string" ? market.metadata.category : market.country;
  const description = typeof market.metadata?.description === "string" ? market.metadata.description : null;
  const kickoffAt = Date.parse(market.startTime);
  const bettingLocked = market.status !== "OPEN" || nowTs === null || (Number.isFinite(kickoffAt) && kickoffAt <= nowTs);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)] flex-wrap">
        <Link href={backHref} className="flex items-center gap-1 hover:text-white shrink-0">
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <span>/</span>
        <span className="truncate max-w-[140px]">{market.leagueName}</span>
        <span>/</span>
        <span className="text-white truncate max-w-[200px]">{title}</span>
      </div>

      {/* Match header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,231,1,0.06),transparent_60%)]" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] truncate">
              {market.leagueName} · {category}
            </span>
            {market.status === "LIVE" ? (
              <span className="mono inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-live border border-live/25 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
                LIVE {market.liveMinute ? `${market.liveMinute}'` : ""}
              </span>
            ) : (
              <span className="mono text-[12px] text-[var(--color-ink-2)] shrink-0">{matchUi.time}</span>
            )}
          </div>
          {isPrediction ? (
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xl sm:text-2xl md:text-3xl font-black leading-tight text-white">{title}</p>
              {description && <p className="mx-auto mt-3 max-w-2xl text-[13px] text-[var(--color-ink-2)]">{description}</p>}
              <p className="mono mt-4 text-[12px] text-[var(--color-ink-3)]">Resolves {matchUi.time}</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 sm:gap-8">
              {/* Home Team */}
              <div className="text-center flex-1 min-w-0">
                <div
                  className="mx-auto mb-2 sm:mb-3 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 text-sm sm:text-xl font-black shadow-lg"
                  style={{ borderColor: matchUi.homeColor, background: `${matchUi.homeColor}20` }}
                >
                  {matchUi.homeShort}
                </div>
                <p className="text-[13px] sm:text-[15px] font-bold text-white leading-tight break-words max-w-[130px] sm:max-w-none mx-auto">
                  {market.homeTeam}
                </p>
              </div>

              {/* Center VS / Live Score */}
              <div className="text-center shrink-0 px-1 sm:px-2">
                {market.status === "LIVE" ? (
                  <>
                    <p className="mono text-3xl sm:text-5xl font-black text-white">
                      {market.homeScore ?? 0}–{market.awayScore ?? 0}
                    </p>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] sm:text-[12px] text-[var(--color-live)] font-bold">
                      <LiveIcon className="h-3.5 w-3.5" />
                      {market.liveMinute ? `${market.liveMinute}'` : "LIVE"}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] sm:text-[13px] font-bold text-[var(--color-ink-2)]">VS</p>
                    <p className="mono mt-1 text-[10px] sm:text-[11px] text-[var(--color-ink-3)]">{matchUi.time}</p>
                  </>
                )}
              </div>

              {/* Away Team */}
              <div className="text-center flex-1 min-w-0">
                <div
                  className="mx-auto mb-2 sm:mb-3 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 text-sm sm:text-xl font-black shadow-lg"
                  style={{ borderColor: matchUi.awayColor, background: `${matchUi.awayColor}20` }}
                >
                  {matchUi.awayShort}
                </div>
                <p className="text-[13px] sm:text-[15px] font-bold text-white leading-tight break-words max-w-[130px] sm:max-w-none mx-auto">
                  {market.awayTeam}
                </p>
              </div>
            </div>
          )}

          {/* Guarantee banner */}
          <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-[var(--color-bg-1)] p-2.5 sm:py-2 text-[12px]">
            <ShieldIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)] shrink-0" />
            <span className="text-[var(--color-ink-2)]">100% Guaranteed On-Chain Smart Contract Payouts</span>
          </div>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-line-1)] bg-[var(--color-bg-2)]/40 p-8 text-center text-[12px] text-[var(--color-ink-3)]">
          No odds available yet for this fixture. The oracle scrapes every 3 minutes —
          markets typically appear within a few minutes of kick-off listing.
        </div>
      ) : (
        <>
          {/* Market tabs */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
            {markets.map((m) => (
              <button
                key={m.id}
                onClick={() => setTab(m.id)}
                className={`h-8 shrink-0 rounded px-3 text-[12px] font-semibold transition-colors ${
                  tab === m.id
                    ? "bg-[var(--color-bg-3)] text-white"
                    : "text-[var(--color-ink-2)] hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Market selections */}
          <div className="mt-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <div className="space-y-3">
              {activeMarket.rows.map((row) => (
                <div key={row.label}>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{row.label}</p>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${Math.min(row.selections.length, 3)}, 1fr)` }}
                  >
                    {row.selections.map((sel) => (
                      <OddsButton
                        key={`${sel.outcome}-${sel.label}`}
                        matchId={market.id}
                        market={`${activeMarket.id}_${row.label}`}
                        selection={sel.label}
                        matchLabel={title}
                        odds={sel.odds}
                        label={sel.label}
                        disabled={bettingLocked}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Match Analysis Panel */}
      {!isPrediction && <MatchStatsPanel market={market} />}
    </div>
  );
}

function MatchStatsPanel({ market }: { market: MarketDTO }) {
  const x2Bundle = market.odds?.find((o) => o.marketType === "1X2");
  if (!x2Bundle || x2Bundle.selections.length === 0) return null;

  const hasDraw = x2Bundle.selections.length === 3;
  const homeOdds = x2Bundle.selections.find((s) => s.outcome === 0)?.valueX1000 ?? 0;
  const drawOdds = hasDraw ? (x2Bundle.selections.find((s) => s.outcome === 1)?.valueX1000 ?? 0) : 0;
  const awayOdds = x2Bundle.selections.find((s) => s.outcome === (hasDraw ? 2 : 1))?.valueX1000 ?? 0;

  const iH = homeOdds > 1000 ? 1000 / homeOdds : 0;
  const iD = drawOdds > 1000 ? 1000 / drawOdds : 0;
  const iA = awayOdds > 1000 ? 1000 / awayOdds : 0;
  const total = iH + iD + iA;
  if (total === 0) return null;

  const pHome = Math.round((iH / total) * 100);
  const pDraw = hasDraw ? Math.round((iD / total) * 100) : 0;
  const pAway = 100 - pHome - pDraw;
  const margin = Math.round((total - 1) * 1000) / 10;

  const marketTypes = [...new Set((market.odds ?? []).map((o) => o.marketType))];

  const ou25 = market.odds?.find((o) => o.marketType === "over_under_25");
  const over25Odds = ou25?.selections.find((s) => s.label?.toLowerCase().includes("over"))?.valueX1000;
  const over25Prob = over25Odds && over25Odds > 1000 ? Math.round((1000 / over25Odds) * 100) : null;

  const bttsYes = market.odds?.find((o) => o.marketType === "btts")?.selections.find((s) => s.label?.toLowerCase() === "yes")?.valueX1000;
  const bttsProb = bttsYes && bttsYes > 1000 ? Math.round((1000 / bttsYes) * 100) : null;

  const marketLabel = (mt: string): string => {
    const fixed: Record<string, string> = {
      "1X2": "1X2", btts: "BTTS", draw_no_bet: "DNB", double_chance: "DC", binary: "Binary",
    };
    if (fixed[mt]) return fixed[mt];
    const ou = mt.match(/^over_under_(\d+)$/);
    if (ou) {
      const lineNum = parseInt(ou[1], 10) / 10;
      const numStr = lineNum % 1 === 0 ? `${lineNum}.0` : lineNum.toFixed(1);
      return `O/U ${numStr}`;
    }
    const ah = mt.match(/^asian_handicap_(-?\d+)$/);
    if (ah) return `AH ${ah[1].replace(/(-?)(\d)(\d)$/, "$1$2.$3")}`;
    return mt.replace(/_/g, " ");
  };

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
        Match Analysis
      </p>

      {/* Win probability bar */}
      <div className="mb-5">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">Win Probability</p>
        <div className="flex h-8 overflow-hidden rounded-lg">
          {pHome > 0 && (
            <div
              className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${pHome}%`, backgroundColor: "var(--color-brand-500)" }}
            >
              {pHome >= 10 ? `${pHome}%` : ""}
            </div>
          )}
          {hasDraw && pDraw > 0 && (
            <div
              className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${pDraw}%`, backgroundColor: "var(--color-warn)" }}
            >
              {pDraw >= 10 ? `${pDraw}%` : ""}
            </div>
          )}
          {pAway > 0 && (
            <div
              className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${pAway}%`, backgroundColor: "var(--color-info)" }}
            >
              {pAway >= 10 ? `${pAway}%` : ""}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-start justify-between text-[11px]">
          <span className="flex flex-col items-start gap-0.5">
            <span className="flex items-center gap-1 text-[var(--color-ink-2)]">
              <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "var(--color-brand-500)" }} />
              {market.homeTeam}
            </span>
            <span className="mono font-bold text-white">{pHome}% · {(homeOdds / 1000).toFixed(2)}</span>
          </span>
          {hasDraw && (
            <span className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1 text-[var(--color-ink-2)]">
                <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "var(--color-warn)" }} />
                Draw
              </span>
              <span className="mono font-bold text-white">{pDraw}% · {(drawOdds / 1000).toFixed(2)}</span>
            </span>
          )}
          <span className="flex flex-col items-end gap-0.5">
            <span className="flex items-center gap-1 text-[var(--color-ink-2)]">
              {market.awayTeam}
              <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "var(--color-info)" }} />
            </span>
            <span className="mono font-bold text-white">{pAway}% · {(awayOdds / 1000).toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="rounded-lg bg-[var(--color-bg-1)] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Vig / Margin</p>
          <p className="mono mt-1 text-[20px] font-black text-white">{margin}%</p>
        </div>
        {over25Prob !== null ? (
          <div className="rounded-lg bg-[var(--color-bg-1)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Over 2.5 Goals</p>
            <p className="mono mt-1 text-[20px] font-black text-white">{over25Prob}%</p>
          </div>
        ) : bttsProb !== null ? (
          <div className="rounded-lg bg-[var(--color-bg-1)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">BTTS Implied</p>
            <p className="mono mt-1 text-[20px] font-black text-white">{bttsProb}%</p>
          </div>
        ) : null}
        <div className="rounded-lg bg-[var(--color-bg-1)] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Markets</p>
          <p className="mono mt-1 text-[20px] font-black text-white">{marketTypes.length}</p>
        </div>
      </div>

      {/* Available market type tags */}
      {marketTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {marketTypes.slice(0, 12).map((mt) => (
            <span
              key={mt}
              className="rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-2)]"
            >
              {marketLabel(mt)}
            </span>
          ))}
        </div>
      )}

      {/* Match context */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-line-1)] pt-3 text-[11px] text-[var(--color-ink-3)]">
        {market.leagueName && <span>{market.leagueName}</span>}
        {market.country && <span>{market.country}</span>}
        {market.sport && market.sport !== "football" && (
          <span className="capitalize">{market.sport.replace(/-/g, " ")}</span>
        )}
      </div>
    </div>
  );
}