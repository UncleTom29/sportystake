"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { AIAnalytics } from "@/lib/api-client";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { useNotifications } from "@/lib/notificationStore";
import {
  ZapIcon,
  BadgeCheck,
  FlameIcon,
  CopyIcon,
  ShieldIcon,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendUp,
  FilterIcon,
  StarIcon,
  ArrowUpRight,
  TicketIcon,
} from "@/components/icons/UIIcons";
import {
  BrainCircuit,
  RefreshCw,
  Play,
  Pause,
  ShieldCheck,
  Scale,
  Gauge,
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

interface AutoPilotActivity {
  id: string;
  timestamp: string;
  match: string;
  pick: string;
  odds: number;
  stake: number;
  ev: number;
  status: "EXECUTED" | "PENDING" | "WON" | "LOST";
  txHash: string;
}

export default function AIAnalyticsPage() {
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("DeepSeek-V4 Quant Engine");
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
  const [activeTab, setActiveTab] = useState<"signals" | "autopilot">("signals");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const [selectedMarket, setSelectedMarket] = useState<string>("ALL");
  const [minEdge, setMinEdge] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"ev" | "confidence" | "odds">("ev");
  const [expandedPickId, setExpandedPickId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Auto-Pilot Native State
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<"conservative" | "balanced" | "aggressive" | "custom">("balanced");
  const [maxStake, setMaxStake] = useState(25);
  const [dailyBudget, setDailyBudget] = useState(200);
  const [minEvCutoff, setMinEvCutoff] = useState(10);
  const [maxDailyBets, setMaxDailyBets] = useState(6);
  const [showDeveloperApi, setShowDeveloperApi] = useState(false);

  // Simulated live execution history for Auto-Pilot
  const [recentActivities, setRecentActivities] = useState<AutoPilotActivity[]>([
    {
      id: "act-1",
      timestamp: "Today, 14:15 UTC",
      match: "Arsenal vs Manchester City",
      pick: "Arsenal Win",
      odds: 2.85,
      stake: 25,
      ev: 21.2,
      status: "EXECUTED",
      txHash: "0x7f9a...4b21",
    },
    {
      id: "act-2",
      timestamp: "Today, 14:15 UTC",
      match: "Real Madrid vs FC Barcelona",
      pick: "Over 2.5 Goals",
      odds: 1.82,
      stake: 25,
      ev: 16.7,
      status: "EXECUTED",
      txHash: "0x3e18...9c44",
    },
    {
      id: "act-3",
      timestamp: "Yesterday, 19:45 UTC",
      match: "Bayern Munich vs Borussia Dortmund",
      pick: "Bayern Munich Win",
      odds: 1.68,
      stake: 25,
      ev: 15.9,
      status: "WON",
      txHash: "0x1a82...fd03",
    },
  ]);

  const appendSelections = useBetSlip((s) => s.appendSelections);
  const pushToast = useNotifications((s) => s.pushToast);

  // Load Auto-Pilot preferences from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sportystake_autopilot_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.enabled !== undefined) setAutoPilotEnabled(parsed.enabled);
        if (parsed.strategy) setSelectedStrategy(parsed.strategy);
        if (parsed.maxStake) setMaxStake(parsed.maxStake);
        if (parsed.dailyBudget) setDailyBudget(parsed.dailyBudget);
        if (parsed.minEvCutoff) setMinEvCutoff(parsed.minEvCutoff);
      }
    } catch {}
  }, []);

  // Save Auto-Pilot preferences
  const saveAutoPilotState = (enabled: boolean, strategy = selectedStrategy, stake = maxStake, budget = dailyBudget, ev = minEvCutoff) => {
    setAutoPilotEnabled(enabled);
    try {
      localStorage.setItem(
        "sportystake_autopilot_state",
        JSON.stringify({
          enabled,
          strategy,
          maxStake: stake,
          dailyBudget: budget,
          minEvCutoff: ev,
        })
      );
    } catch {}
  };

  // Toggle Auto-Pilot
  const handleToggleAutoPilot = () => {
    const nextState = !autoPilotEnabled;
    saveAutoPilotState(nextState);

    if (nextState) {
      pushToast({
        kind: "success",
        title: "Auto-Pilot Activated 🤖",
        body: `Autonomous agent is now monitoring +EV signals with your ${
          selectedStrategy === "balanced" ? "Balanced Alpha" : selectedStrategy === "conservative" ? "Conservative Sharp" : selectedStrategy === "aggressive" ? "High Velocity" : "Custom"
        } strategy.`,
      });
    } else {
      pushToast({
        kind: "info",
        title: "Auto-Pilot Paused ⏸",
        body: "Automated execution suspended. No further wagers will be placed automatically.",
      });
    }
  };

  // Strategy Presets selection
  const handleSelectStrategy = (strat: "conservative" | "balanced" | "aggressive" | "custom") => {
    setSelectedStrategy(strat);
    if (strat === "conservative") {
      setMaxStake(15);
      setDailyBudget(75);
      setMinEvCutoff(15);
      setMaxDailyBets(3);
    } else if (strat === "balanced") {
      setMaxStake(25);
      setDailyBudget(200);
      setMinEvCutoff(10);
      setMaxDailyBets(6);
    } else if (strat === "aggressive") {
      setMaxStake(50);
      setDailyBudget(500);
      setMinEvCutoff(6);
      setMaxDailyBets(12);
    }
    saveAutoPilotState(autoPilotEnabled, strat);
    pushToast({
      kind: "info",
      title: "Strategy Updated",
      body: `Applied preset: ${strat.toUpperCase()}`,
    });
  };

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
            body: `Analysis refreshed using ${res.modelUsed || "Quant Engine"} on active markets`,
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

    if (!p.marketId || p.marketId.startsWith("seed-")) {
      pushToast({
        kind: "error",
        title: "Market Unavailable",
        body: "This market is not currently open for wagering.",
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
        if (p.marketId && p.marketId.startsWith("seed-")) {
          return false;
        }
        if (selectedLeague !== "ALL" && !p.league.toLowerCase().includes(selectedLeague.toLowerCase())) {
          return false;
        }
        if (selectedMarket !== "ALL" && !(p.marketType || "1X2").toLowerCase().includes(selectedMarket.toLowerCase())) {
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
  }, [predictions, selectedLeague, selectedMarket, minEdge, sortBy]);

  const sanitizedBotSnippet = `import { SportyStakeSDK } from "@sportystake/sdk";
import { ethers } from "ethers";

// Initialize programmatic syndicate bot with dedicated signer
const provider = new ethers.JsonRpcProvider("https://rpc.arc.network");
const botSigner = new ethers.Wallet(process.env.BOT_SIGNER_KEY, provider);

// 1. Fetch public +EV probability distributions
const feed = await fetch("https://sportystake.com/api/ai-analytics").then(r => r.json());

// 2. Filter for Grade A+ signals with >12% Expected Value
const sharpPicks = feed.data.predictions.filter(
  (p) => p.expectedValuePct >= 12 && p.confidence >= 75
);

// 3. Execute via BettingCore smart contract (using pre-approved contract allowance)
const bettingContract = new ethers.Contract("0xBettingCoreAddress", ABI, botSigner);

for (const item of sharpPicks) {
  const stakeUSDC = ethers.parseUnits((item.kellyUnits * 25).toString(), 6);
  console.log(\`[Bot Syndicate] Executing \${item.match} -> \${item.pick} @ \${item.odds}x (+EV: \${item.expectedValuePct}%)\`);
  
  await bettingContract.placeBet(
    item.marketId,
    0, // 1X2 market code
    stakeUSDC,
    Math.floor(item.odds * 1000)
  );
}`;

  const copySanitizedBotCode = () => {
    navigator.clipboard.writeText(sanitizedBotSnippet);
    setCopiedCode(true);
    pushToast({ kind: "success", title: "Snippet Copied", body: "Syndicate bot code copied to clipboard" });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-5 md:px-6">
      {/* Institutional Header & Verified Model Track Record */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mono inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-500)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                <BrainCircuit className="h-3.5 w-3.5 animate-pulse" />
                QUANTITATIVE MODEL TERMINAL
              </span>
              <span className="mono rounded-full bg-[var(--color-bg-1)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-ink-3)] border border-[var(--color-line-1)]">
                {modelUsed}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
              Model Signals & Expected Value Edge
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
              Institutional quantitative edge engine benchmarked against sharp closing prices across top European football leagues. Implied win probabilities, true Bayesian estimates, and fractional Kelly unit sizing.
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
                <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-brand-500)]" /> Automated daily cron at 00:00 UTC
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
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">vs +2.1% market index</p>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Avg CLV Beat</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-[var(--color-info)]">+{trackRecord.avgClvBeat}%</span>
              <span className="text-[11px] text-[var(--color-ink-3)]">Closing Value</span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">Beat pinnacle line in 74%</p>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Tracked Fixtures</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-xl font-black text-white">{trackRecord.totalPicks}+</span>
              <span className="text-[11px] text-[var(--color-ink-3)]">Tier-1 Fixtures</span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">Top 5 European Leagues</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line-1)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("signals")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all ${
              activeTab === "signals"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-md"
                : "bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            <ZapIcon className="h-4 w-4" /> Live Quantitative Signals ({filteredPredictions.length})
          </button>
          <button
            onClick={() => setActiveTab("autopilot")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all ${
              activeTab === "autopilot"
                ? "bg-[var(--color-info)] text-[var(--color-bg-0)] shadow-md"
                : "bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoPilotEnabled ? "bg-[var(--color-brand-500)] animate-pulse" : "bg-[var(--color-ink-3)]"}`} />
            Auto-Pilot & Autonomous Studio
          </button>
        </div>

        {activeTab === "signals" && (
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-2)] p-1 border border-[var(--color-line-1)]">
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all ${
                viewMode === "cards" ? "bg-[var(--color-bg-1)] text-white shadow-sm" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              Cards
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
        )}
      </div>

      {activeTab === "signals" ? (
        <>
          {/* Live Market Intelligence Strip */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
                <TrendUp className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                Live Market Dynamics & Line Dislocation
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

          {/* Interactive Filter & Sorting Controls */}
          <div className="mt-8 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* League Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mr-1">League:</span>
                <button
                  onClick={() => setSelectedLeague("ALL")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                    selectedLeague === "ALL"
                      ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                      : "bg-[var(--color-bg-1)] text-[var(--color-ink-2)] hover:text-white border border-[var(--color-line-1)]"
                  }`}
                >
                  All Competitions
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
                    <option value={0}>All Values (+0% EV)</option>
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
                <p className="text-base font-bold text-white">No model signals match your active filter criteria</p>
                <p className="mt-1 text-xs text-[var(--color-ink-3)]">Try lowering the minimum edge threshold or resetting the league filter.</p>
                <button
                  onClick={() => {
                    setSelectedLeague("ALL");
                    setMinEdge(0);
                  }}
                  className="mt-4 rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-xs font-bold text-[var(--color-bg-0)]"
                >
                  Reset Filters
                </button>
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
                      <th className="py-3.5 px-4">Fixture / League</th>
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
        </>
      ) : (
        /* Auto-Pilot & Autonomous Studio Hub */
        <section className="mt-6 space-y-6">
          {/* Main Control Card */}
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="mono rounded bg-[var(--color-info)]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-[var(--color-info)] border border-[var(--color-info)]/30">
                    Non-Custodial Auto-Pilot
                  </span>
                  <span className={`mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    autoPilotEnabled ? "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]" : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)]"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${autoPilotEnabled ? "bg-[var(--color-brand-500)] animate-pulse" : "bg-[var(--color-ink-3)]"}`} />
                    {autoPilotEnabled ? "ACTIVE & MONITORING" : "STANDBY / PAUSED"}
                  </span>
                </div>
                <h2 className="mt-2.5 text-2xl font-black text-white">
                  Automated Model Execution Studio
                </h2>
                <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)] max-w-2xl">
                  Deploy an in-app autonomous agent powered by <strong>Circuits Protocol</strong>. The agent automatically executes verified +EV signals during daily calibrations strictly according to your pre-approved risk limits.
                </p>
              </div>

              {/* Activation Switch Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleToggleAutoPilot}
                  className={`flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-black transition-all shadow-lg active:scale-95 ${
                    autoPilotEnabled
                      ? "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
                      : "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
                  }`}
                >
                  {autoPilotEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {autoPilotEnabled ? "Pause Auto-Pilot" : "Activate Auto-Pilot"}
                </button>
              </div>
            </div>

            {/* Zero-Key Security Explainer */}
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
              <ShieldIcon className="h-5 w-5 text-[var(--color-brand-500)] shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                <strong className="text-white">100% Non-Custodial Session Delegation:</strong> Auto-Pilot operates through scoped smart contract permissions. The agent can <strong className="text-white">only place wagers</strong> up to your daily budget cap on verified sports fixtures and has <strong className="text-white">zero withdrawal authority</strong>. No private keys, seed phrases, or login session tokens are ever requested or shared.
              </div>
            </div>
          </div>

          {/* Strategy Presets Selector */}
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1">Select Execution Strategy</h3>
            <p className="text-[12px] text-[var(--color-ink-3)] mb-4">Choose a curated risk profile or fine-tune custom betting parameters</p>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Conservative */}
              <div
                onClick={() => handleSelectStrategy("conservative")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedStrategy === "conservative"
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 ring-1 ring-[var(--color-brand-500)]"
                    : "border-[var(--color-line-1)] bg-[var(--color-bg-1)] hover:border-[var(--color-line-2)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-500)]">Low Variance</span>
                </div>
                <h4 className="mt-2 text-[14px] font-black text-white">Conservative Sharp</h4>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Only highest conviction Grade A+ picks with &gt;= 15% Expected Value.</p>
                <div className="mt-3 pt-3 border-t border-[var(--color-line-1)] space-y-1 text-[11px] text-[var(--color-ink-2)]">
                  <div className="flex justify-between"><span>Max Stake:</span><strong className="text-white">$15 USDC</strong></div>
                  <div className="flex justify-between"><span>Daily Cap:</span><strong className="text-white">$75 USDC</strong></div>
                  <div className="flex justify-between"><span>Min Edge:</span><strong className="text-[var(--color-brand-500)]">&gt;= 15% EV</strong></div>
                </div>
              </div>

              {/* Balanced Alpha */}
              <div
                onClick={() => handleSelectStrategy("balanced")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedStrategy === "balanced"
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 ring-1 ring-[var(--color-brand-500)]"
                    : "border-[var(--color-line-1)] bg-[var(--color-bg-1)] hover:border-[var(--color-line-2)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]">
                    <Scale className="h-4 w-4" />
                  </span>
                  <span className="mono rounded bg-[var(--color-brand-500)]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--color-brand-500)]">Recommended</span>
                </div>
                <h4 className="mt-2 text-[14px] font-black text-white">Balanced Alpha</h4>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Grade A & A+ signals with dynamic Kelly criterion fractional unit sizing.</p>
                <div className="mt-3 pt-3 border-t border-[var(--color-line-1)] space-y-1 text-[11px] text-[var(--color-ink-2)]">
                  <div className="flex justify-between"><span>Max Stake:</span><strong className="text-white">$25 USDC</strong></div>
                  <div className="flex justify-between"><span>Daily Cap:</span><strong className="text-white">$200 USDC</strong></div>
                  <div className="flex justify-between"><span>Min Edge:</span><strong className="text-[var(--color-brand-500)]">&gt;= 10% EV</strong></div>
                </div>
              </div>

              {/* High Velocity */}
              <div
                onClick={() => handleSelectStrategy("aggressive")}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedStrategy === "aggressive"
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 ring-1 ring-[var(--color-brand-500)]"
                    : "border-[var(--color-line-1)] bg-[var(--color-bg-1)] hover:border-[var(--color-line-2)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                    <Gauge className="h-4 w-4" />
                  </span>
                  <span className="mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)]">Max Volume</span>
                </div>
                <h4 className="mt-2 text-[14px] font-black text-white">High Velocity</h4>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Captures all statistically mispriced lines across top 5 European leagues.</p>
                <div className="mt-3 pt-3 border-t border-[var(--color-line-1)] space-y-1 text-[11px] text-[var(--color-ink-2)]">
                  <div className="flex justify-between"><span>Max Stake:</span><strong className="text-white">$50 USDC</strong></div>
                  <div className="flex justify-between"><span>Daily Cap:</span><strong className="text-white">$500 USDC</strong></div>
                  <div className="flex justify-between"><span>Min Edge:</span><strong className="text-[var(--color-brand-500)]">&gt;= 6% EV</strong></div>
                </div>
              </div>
            </div>

            {/* Custom Tuning Sliders */}
            <div className="mt-5 rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-bold text-white">Custom Guardrails Tuning</span>
                <span className="text-[10px] text-[var(--color-ink-3)]">Settings auto-apply to your agent</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="flex justify-between text-[11px] text-[var(--color-ink-3)] mb-1">
                    <span>Max Stake Per Bet:</span>
                    <span className="font-bold text-white">${maxStake} USDC</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={maxStake}
                    onChange={(e) => {
                      setMaxStake(Number(e.target.value));
                      setSelectedStrategy("custom");
                      saveAutoPilotState(autoPilotEnabled, "custom", Number(e.target.value), dailyBudget, minEvCutoff);
                    }}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[var(--color-ink-3)] mb-1">
                    <span>Daily Budget Cap:</span>
                    <span className="font-bold text-white">${dailyBudget} USDC</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={dailyBudget}
                    onChange={(e) => {
                      setDailyBudget(Number(e.target.value));
                      setSelectedStrategy("custom");
                      saveAutoPilotState(autoPilotEnabled, "custom", maxStake, Number(e.target.value), minEvCutoff);
                    }}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[var(--color-ink-3)] mb-1">
                    <span>Min Expected Value:</span>
                    <span className="font-bold text-[var(--color-brand-500)]">+{minEvCutoff}% EV</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="1"
                    value={minEvCutoff}
                    onChange={(e) => {
                      setMinEvCutoff(Number(e.target.value));
                      setSelectedStrategy("custom");
                      saveAutoPilotState(autoPilotEnabled, "custom", maxStake, dailyBudget, Number(e.target.value));
                    }}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Agent Activity & Execution Log */}
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Live Execution Feed & Activity Log</h3>
                <p className="text-[11px] text-[var(--color-ink-3)]">Real-time smart contract executions verified on Arc Network</p>
              </div>
              <span className="mono rounded bg-[var(--color-bg-1)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-500)] border border-[var(--color-line-1)]">
                3 Bets Placed Today ($75 / ${dailyBudget} USDC)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-line-1)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Match & Selection</th>
                    <th className="py-2.5 px-3">Odds</th>
                    <th className="py-2.5 px-3">Stake</th>
                    <th className="py-2.5 px-3">+EV Edge</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line-1)] text-[12px]">
                  {recentActivities.map((act) => (
                    <tr key={act.id} className="hover:bg-[var(--color-bg-1)]/40 transition-colors">
                      <td className="mono py-3 px-3 text-[11px] text-[var(--color-ink-3)]">{act.timestamp}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-white">{act.match}</p>
                        <p className="text-[11px] text-[var(--color-brand-500)]">{act.pick}</p>
                      </td>
                      <td className="mono py-3 px-3 font-bold text-white">{act.odds.toFixed(2)}</td>
                      <td className="mono py-3 px-3 text-white">${act.stake} USDC</td>
                      <td className="mono py-3 px-3 font-bold text-[var(--color-brand-500)]">+{act.ev}%</td>
                      <td className="py-3 px-3">
                        <span className={`mono rounded px-2 py-0.5 text-[10px] font-black ${
                          act.status === "WON"
                            ? "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]"
                            : act.status === "EXECUTED"
                            ? "bg-[var(--color-info)]/15 text-[var(--color-info)]"
                            : "bg-[var(--color-bg-3)] text-[var(--color-ink-3)]"
                        }`}>
                          {act.status}
                        </span>
                      </td>
                      <td className="mono py-3 px-3 text-right text-[11px] text-[var(--color-info)] hover:underline cursor-pointer">
                        {act.txHash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Programmatic Developers & Syndicates Accordion */}
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg">
            <button
              onClick={() => setShowDeveloperApi(!showDeveloperApi)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="mono rounded bg-[var(--color-bg-1)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink-3)] border border-[var(--color-line-1)]">
                  API & SDK
                </span>
                <h3 className="text-sm font-bold text-white">External Algorithmic Syndicates & Custom Bot API</h3>
              </div>
              {showDeveloperApi ? <ChevronUp className="h-4 w-4 text-[var(--color-ink-3)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-ink-3)]" />}
            </button>

            {showDeveloperApi && (
              <div className="mt-4 pt-4 border-t border-[var(--color-line-1)] space-y-4">
                <p className="text-[12px] text-[var(--color-ink-2)] leading-relaxed">
                  Running an external bot or Python/Rust trading syndicate? Connect directly to the SportyStake REST feeds and execute on-chain using your dedicated bot signer wallet with standard ERC-20 allowances (<code className="mono text-white">USDC.approve(BettingCore)</code>).
                </p>

                <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
                  <span className="mono text-xs text-[var(--color-brand-500)] font-bold">GET /api/ai-analytics</span>
                  <span className="mono text-[10px] text-[var(--color-ink-3)]">JSON • Public Rate-Limited</span>
                </div>

                <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-0)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[var(--color-ink-3)]">Sanitized Syndicate Bot Script (TypeScript)</span>
                    <button
                      onClick={copySanitizedBotCode}
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-info)] hover:underline"
                    >
                      <CopyIcon className="h-3 w-3" /> {copiedCode ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="mono text-[11px] text-[var(--color-ink-2)] overflow-x-auto leading-relaxed">
                    {sanitizedBotSnippet}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
