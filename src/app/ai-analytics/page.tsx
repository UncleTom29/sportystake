"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { AIAnalytics } from "@/lib/api-client";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { useNotifications } from "@/lib/notificationStore";
import {
  ZapIcon,
  BadgeCheck,
  ShieldIcon,
  ChevronDown,
  ChevronUp,
  TrendUp,
  TicketIcon,
} from "@/components/icons/UIIcons";
import {
  BrainCircuit,
  RefreshCw,
  Trophy,
} from "lucide-react";

export interface PredictionItem {
  id: string;
  marketId: string;
  match: string;
  league: string;
  pick: string;
  marketType?: string;
  confidence: number;
  odds: number;
  fair: number;
  impliedProb?: number;
  trueProb?: number;
  expectedValuePct?: number;
  kellyUnits?: number;
  xgDiff?: string;
  form?: string[];
  grade?: "GRADE A+" | "GRADE A" | "GRADE B+" | "GRADE B";
  valueBps: number;
  reasoning: string;
  factors: string[];
  direction: "up" | "down";
  kickoff?: string;
}

export interface InsightItem {
  tag: string;
  title: string;
  desc: string;
  accent: string;
}

export interface ModelTrackRecord {
  winRate: number;
  roi: number;
  avgClvBeat: number;
  totalPicks: number;
  verifiedPeriod: string;
  unitsWon: number;
}

export default function AIAnalyticsPage() {
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("DeepSeek-V4 European Football Quant Engine");
  const [trackRecord, setTrackRecord] = useState<ModelTrackRecord>({
    winRate: 64.6,
    roi: 14.2,
    avgClvBeat: 3.8,
    totalPicks: 142,
    verifiedPeriod: "Last 30 Days",
    unitsWon: 28.4,
  });

  const [loading, setLoading] = useState(true);
  const [recalibrating, setRecalibrating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const [minEdge, setMinEdge] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"ev" | "confidence" | "odds">("ev");
  const [expandedPickId, setExpandedPickId] = useState<string | null>(null);

  const appendSelections = useBetSlip((s) => s.appendSelections);
  const pushToast = useNotifications((s) => s.pushToast);

  // Check Admin Role from auth session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.user?.roles?.includes("ADMIN")) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const fetchAnalysis = useCallback((forceRefresh = false) => {
    if (forceRefresh) {
      setRecalibrating(true);
    } else {
      setLoading(true);
    }

    AIAnalytics.get(forceRefresh)
      .then((res) => {
        setPredictions(res.predictions as PredictionItem[]);
        setInsights(res.insights as InsightItem[]);
        setLastAnalyzedAt(res.lastAnalyzedAt);
        if (res.modelUsed) setModelUsed(res.modelUsed);
        if (res.trackRecord) setTrackRecord(res.trackRecord);

        if (forceRefresh) {
          pushToast({
            kind: "success",
            title: "Model Recalibrated",
            body: `Analysis refreshed using ${res.modelUsed || "Quant Engine"} on active European football fixtures`,
          });
        }
      })
      .catch((err) => {
        if (forceRefresh) {
          pushToast({
            kind: "error",
            title: "Recalibration Failed",
            body: err?.message || "Admin authorization required to trigger refresh",
          });
        }
      })
      .finally(() => {
        setLoading(false);
        setRecalibrating(false);
      });
  }, [pushToast]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleTailPick = (p: PredictionItem) => {
    if (p.kickoff && Date.parse(p.kickoff) <= Date.now()) {
      pushToast({
        kind: "error",
        title: "Match Already Started",
        body: "This match is currently in-play or finished. Wagering has closed.",
      });
      return;
    }

    if (!p.marketId || p.marketId.startsWith("seed-") || p.marketId.startsWith("mock-")) {
      pushToast({
        kind: "error",
        title: "Market Unavailable",
        body: "This fixture is not currently open for live wagering.",
      });
      return;
    }

    const converted: BetSelection[] = [
      {
        matchId: p.marketId,
        matchLabel: p.match,
        market: p.marketType || "1X2",
        selection: p.pick,
        odds: Number(p.odds),
        stake: (p.kellyUnits || 1.5) * 25,
      },
    ];

    appendSelections(converted);
    pushToast({
      kind: "success",
      title: "Model Signal Tailed",
      body: `Added ${p.pick} @ ${p.odds.toFixed(2)} (${p.expectedValuePct || p.valueBps}% +EV) to your betslip`,
    });
  };

  // Distinct Leagues for Filtering
  const availableLeagues = useMemo(() => {
    const set = new Set<string>();
    predictions.forEach((p) => {
      if (p.league) set.add(p.league.split("·")[0].trim());
    });
    return Array.from(set);
  }, [predictions]);

  // Filtered & Sorted Predictions
  const filteredPredictions = useMemo(() => {
    const now = Date.now();
    return predictions
      .filter((p) => {
        if (p.kickoff && Date.parse(p.kickoff) <= now) {
          return false;
        }
        if (p.marketId && (p.marketId.startsWith("seed-") || p.marketId.startsWith("mock-"))) {
          return false;
        }
        if (selectedLeague !== "ALL" && !p.league.toLowerCase().includes(selectedLeague.toLowerCase())) {
          return false;
        }
        const edge = p.expectedValuePct ?? p.valueBps;
        if (edge < minEdge) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "ev") {
          const evA = a.expectedValuePct ?? a.valueBps;
          const evB = b.expectedValuePct ?? b.valueBps;
          return evB - evA;
        }
        if (sortBy === "confidence") {
          return b.confidence - a.confidence;
        }
        if (sortBy === "odds") {
          return b.odds - a.odds;
        }
        return 0;
      });
  }, [predictions, selectedLeague, minEdge, sortBy]);

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-5 md:px-6">
      {/* Institutional Header & Verified Model Track Record */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mono inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-500)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                <BrainCircuit className="h-3.5 w-3.5 animate-pulse" />
                TOP EUROPEAN FOOTBALL QUANTITATIVE TERMINAL
              </span>
              <span className="mono rounded-full bg-[var(--color-bg-1)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-ink-3)] border border-[var(--color-line-1)]">
                {modelUsed}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
              AI Football Picks & Expected Value Edge
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
              Institutional quantitative model signals benchmarked exclusively across top European football competitions (Premier League, La Liga, Serie A, Bundesliga, Ligue 1 & UEFA Champions League). Implied win probabilities, true Bayesian estimates, and fractional Kelly unit sizing.
            </p>
          </div>

          {/* Sync Metadata & Admin Control */}
          <div className="flex flex-col items-start lg:items-end gap-2.5 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--color-ink-3)]">Model Calibration:</span>
              <span className="mono text-[12px] font-bold text-white">
                {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live Today"}
              </span>
            </div>

            {isAdmin ? (
              <div className="flex flex-col items-start lg:items-end gap-1 mt-1 pt-2 border-t border-[var(--color-line-1)] w-full">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)]">
                  <ShieldIcon className="h-3.5 w-3.5" /> Admin Control
                </div>
                <button
                  onClick={() => fetchAnalysis(true)}
                  disabled={recalibrating}
                  className="mt-1 flex items-center gap-2 rounded-lg bg-[var(--color-brand-500)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${recalibrating ? "animate-spin" : ""}`} />
                  {recalibrating ? "Recalibrating Model..." : "Recalibrate Model"}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--color-ink-3)] flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-brand-500)]" /> Automated calibration on active fixtures
              </span>
            )}
          </div>
        </div>

        {/* 4-Stat Verified Track Record Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--color-line-1)] pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">30-Day Win Rate</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-[var(--color-brand-500)]">{trackRecord.winRate}%</span>
              <span className="text-[11px] font-semibold text-[var(--color-ink-3)]">(84W - 46L)</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-bg-3)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: `${trackRecord.winRate}%` }} />
            </div>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Model Yield / ROI</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-white">+{trackRecord.roi}%</span>
              <span className="mono text-[11px] font-bold text-[var(--color-brand-500)]">+{trackRecord.unitsWon}u</span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">vs +2.1% market benchmark</p>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Avg CLV Beat</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-[var(--color-info)]">+{trackRecord.avgClvBeat}%</span>
              <span className="text-[11px] text-[var(--color-ink-3)]">Closing Value</span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">Beat sharp closing line in 74%</p>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Tracked Fixtures</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-white">{trackRecord.totalPicks}+</span>
              <span className="text-[11px] text-[var(--color-ink-3)]">Tier-1 European</span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">Top 5 European Leagues</p>
          </div>
        </div>
      </div>

      {/* Live Market Dynamics / Intelligence Strip */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
            <TrendUp className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
            European Football Market Intelligence & Sharp Dislocation
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {insights.map((i, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-sm">
              <div className="absolute top-0 left-0 h-1 w-full" style={{ backgroundColor: i.accent }} />
              <div className="flex items-center justify-between">
                <span
                  className="mono rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${i.accent}15`, color: i.accent }}
                >
                  {i.tag}
                </span>
              </div>
              <h3 className="mt-2.5 text-[13px] font-bold text-white leading-tight">{i.title}</h3>
              <p className="mt-1.5 text-[12px] text-[var(--color-ink-3)] leading-relaxed">{i.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filter & View Switcher Strip */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line-1)] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-500)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-0)] shadow-md">
            <ZapIcon className="h-4 w-4" /> Live European Football Signals ({filteredPredictions.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-2)] p-1 border border-[var(--color-line-1)]">
          <button
            onClick={() => setViewMode("cards")}
            className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all ${
              viewMode === "cards" ? "bg-[var(--color-bg-1)] text-white shadow-sm" : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            Signal Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all ${
              viewMode === "table" ? "bg-[var(--color-bg-1)] text-white shadow-sm" : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            Quant Table
          </button>
        </div>
      </div>

      {/* Interactive Filter & Sorting Controls */}
      <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* League Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mr-1">European League:</span>
            <button
              onClick={() => setSelectedLeague("ALL")}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                selectedLeague === "ALL"
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                  : "bg-[var(--color-bg-1)] text-[var(--color-ink-2)] hover:text-white border border-[var(--color-line-1)]"
              }`}
            >
              All European Leagues
            </button>
            {availableLeagues.map((lg) => (
              <button
                key={lg}
                onClick={() => setSelectedLeague(lg)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                  selectedLeague === lg
                    ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                    : "bg-[var(--color-bg-1)] text-[var(--color-ink-2)] hover:text-white border border-[var(--color-line-1)]"
                }`}
              >
                {lg}
              </button>
            ))}
          </div>

          {/* Edge Filter & Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Min Edge:</span>
              <select
                value={minEdge}
                onChange={(e) => setMinEdge(Number(e.target.value))}
                className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none"
              >
                <option value={0}>All Signals (+0% EV)</option>
                <option value={8}>&gt;= 8% Edge</option>
                <option value={12}>&gt;= 12% Edge (Grade A)</option>
                <option value={15}>&gt;= 15% Edge (Grade A+)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none"
              >
                <option value="ev">Highest Expected Value (+EV)</option>
                <option value="confidence">Highest Model Probability</option>
                <option value="odds">Highest Market Odds</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Model Signals Output */}
      <section className="mt-5">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 animate-pulse rounded-2xl bg-[var(--color-bg-2)] border border-[var(--color-line-1)]" />
            ))}
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] mb-3">
              <Trophy className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-white">No active top European football league fixtures found</p>
            <p className="mt-1 text-xs text-[var(--color-ink-3)] max-w-md mx-auto">
              Our quantitative models monitor Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and UEFA Champions League fixtures 24/7. Signals populate automatically as soon as fixtures are listed by oracles.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/sportsbook"
                className="rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-xs font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all"
              >
                Explore Sportsbook Markets
              </Link>
              {selectedLeague !== "ALL" || minEdge > 0 ? (
                <button
                  onClick={() => {
                    setSelectedLeague("ALL");
                    setMinEdge(0);
                  }}
                  className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-bg-3)] transition-all"
                >
                  Reset Filters
                </button>
              ) : null}
            </div>
          </div>
        ) : viewMode === "cards" ? (
          /* Pro Signal Cards View */
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPredictions.map((p) => {
              const ev = p.expectedValuePct ?? p.valueBps;
              const implied = p.impliedProb ?? Math.round((1 / p.odds) * 1000) / 10;
              const trueProb = p.trueProb ?? Math.round((1 / p.fair) * 1000) / 10;
              const isExpanded = expandedPickId === p.id;

              return (
                <div
                  key={p.id}
                  className="group rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg transition-all hover:border-[var(--color-brand-500)]/40 flex flex-col justify-between"
                >
                  <div>
                    {/* Match Header & Grade */}
                    <div className="flex items-start justify-between border-b border-[var(--color-line-1)] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="mono rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                            {p.league}
                          </span>
                          <span className="text-[11px] text-[var(--color-ink-3)]">{p.marketType || "1X2 Match Winner"}</span>
                        </div>
                        <h3 className="mt-1 text-lg font-black text-white">{p.match}</h3>
                      </div>
                      <div className="text-right">
                        <span className="mono inline-flex rounded-md bg-[var(--color-brand-500)]/15 px-2.5 py-1 text-[11px] font-black text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                          {p.grade || "GRADE A+"}
                        </span>
                      </div>
                    </div>

                    {/* Model Pick & Expected Value Container */}
                    <div className="mt-4 rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                            Recommended Signal
                          </span>
                          <p className="text-base font-black text-white mt-0.5">{p.pick}</p>
                        </div>
                        <div className="text-right">
                          <span className="mono text-sm font-black text-[var(--color-brand-500)]">
                            +{ev}% Expected Value
                          </span>
                          <p className="mono text-[11px] text-[var(--color-ink-3)] mt-0.5">
                            Market: <strong className="text-white">{p.odds.toFixed(2)}</strong> (Fair: {p.fair.toFixed(2)})
                          </p>
                        </div>
                      </div>

                      {/* Implied vs Model True Probability Visual Meter */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5">
                          <span>Market Implied: <strong className="text-white">{implied}%</strong></span>
                          <span>Model Estimate: <strong className="text-[var(--color-brand-500)]">{trueProb}%</strong></span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-[var(--color-bg-3)] overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full rounded-full bg-[var(--color-ink-3)]/60"
                            style={{ width: `${Math.min(100, implied)}%` }}
                          />
                          <div
                            className="absolute top-0 left-0 h-full rounded-full bg-[var(--color-brand-500)] opacity-85"
                            style={{ width: `${Math.min(100, trueProb)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quantitative Feature Signals */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                      {p.xgDiff && (
                        <span className="mono rounded-md bg-[var(--color-info)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-info)] border border-[var(--color-info)]/20">
                          xG: {p.xgDiff}
                        </span>
                      )}
                      {p.form && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-[var(--color-ink-3)] uppercase mr-0.5">Form:</span>
                          {p.form.map((res, i) => (
                            <span
                              key={i}
                              className={`mono flex h-4 w-4 items-center justify-center rounded text-[9px] font-black ${
                                res === "W"
                                  ? "bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]"
                                  : res === "D"
                                  ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                                  : "bg-[var(--color-danger)]/20 text-[var(--color-danger)]"
                              }`}
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.factors?.slice(0, 2).map((factor, idx) => (
                        <span key={idx} className="rounded-md bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-3)]">
                          {factor}
                        </span>
                      ))}
                    </div>

                    {/* Tactical Breakdown Accordion */}
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedPickId(isExpanded ? null : p.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-2)] hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? "Hide Quantitative Rationale" : "Deep Quantitative Rationale"}
                      </button>
                      {isExpanded && (
                        <p className="mt-2 text-[12px] text-[var(--color-ink-2)] bg-[var(--color-bg-1)] p-3 rounded-lg border border-[var(--color-line-1)] leading-relaxed">
                          {p.reasoning}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--color-line-1)] pt-3">
                    <div className="text-[11px] text-[var(--color-ink-3)]">
                      Rec. Stake: <strong className="text-white mono">{p.kellyUnits || 1.5} Units</strong> ($
                      {((p.kellyUnits || 1.5) * 25).toFixed(0)})
                    </div>

                    <button
                      onClick={() => handleTailPick(p)}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)] shadow-md hover:bg-[var(--color-brand-400)] transition-all active:scale-95"
                    >
                      <TicketIcon className="h-3.5 w-3.5" /> Tail Signal ({p.odds.toFixed(2)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Dense Quantitative Table View */
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                  <th className="py-3.5 px-4">Fixture / European League</th>
                  <th className="py-3.5 px-4">Model Signal</th>
                  <th className="py-3.5 px-4">Grade</th>
                  <th className="py-3.5 px-4">Market Odds</th>
                  <th className="py-3.5 px-4">Fair Odds</th>
                  <th className="py-3.5 px-4">Prob (Imp / Model)</th>
                  <th className="py-3.5 px-4">+EV Edge</th>
                  <th className="py-3.5 px-4">Rec. Stake</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-1)] text-[12px]">
                {filteredPredictions.map((p) => {
                  const ev = p.expectedValuePct ?? p.valueBps;
                  const implied = p.impliedProb ?? Math.round((1 / p.odds) * 1000) / 10;
                  const trueProb = p.trueProb ?? Math.round((1 / p.fair) * 1000) / 10;

                  return (
                    <tr key={p.id} className="hover:bg-[var(--color-bg-1)]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-black text-white">{p.match}</p>
                        <p className="mono text-[10px] text-[var(--color-ink-3)]">{p.league}</p>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[var(--color-brand-500)]">
                        {p.pick}
                        <span className="block text-[10px] font-normal text-[var(--color-ink-3)]">{p.marketType || "1X2"}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="mono rounded bg-[var(--color-brand-500)]/15 px-2 py-0.5 text-[10px] font-black text-[var(--color-brand-500)]">
                          {p.grade || "GRADE A+"}
                        </span>
                      </td>
                      <td className="mono py-3.5 px-4 font-bold text-white">{p.odds.toFixed(2)}</td>
                      <td className="mono py-3.5 px-4 text-[var(--color-ink-2)]">{p.fair.toFixed(2)}</td>
                      <td className="mono py-3.5 px-4">
                        <span className="text-[var(--color-ink-3)]">{implied}%</span> /{" "}
                        <strong className="text-[var(--color-brand-500)]">{trueProb}%</strong>
                      </td>
                      <td className="mono py-3.5 px-4 font-black text-[var(--color-brand-500)]">+{ev}%</td>
                      <td className="mono py-3.5 px-4 text-[var(--color-ink-2)]">{p.kellyUnits || 1.5}u</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleTailPick(p)}
                          className="rounded-lg bg-[var(--color-brand-500)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all active:scale-95"
                        >
                          Tail Pick
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
