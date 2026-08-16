"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "@/components/icons/UIIcons";

export default function AIAnalyticsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("Claude Fable AI (Anthropic)");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"picks" | "circuits">("picks");
  const [copiedCode, setCopiedCode] = useState(false);

  const appendSelections = useBetSlip((s) => s.appendSelections);
  const pushToast = useNotifications((s) => s.pushToast);

  const fetchAnalysis = useCallback((refresh = false) => {
    setLoading(true);
    AIAnalytics.get(refresh)
      .then((res) => {
        setPredictions(res.predictions);
        setInsights(res.insights);
        setLastAnalyzedAt(res.lastAnalyzedAt);
        setModelUsed(res.modelUsed || "Claude Fable AI (Anthropic)");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleTailPick = (p: any) => {
    const converted: BetSelection[] = [
      {
        matchId: p.marketId || `ai-${p.id}`,
        matchLabel: p.match,
        market: "1X2",
        selection: p.pick,
        odds: Number(p.odds),
        stake: 25,
      },
    ];

    appendSelections(converted);
    pushToast({
      kind: "success",
      title: "AI Pick Tailed! 🤖",
      body: `Added ${p.pick} (${p.odds.toFixed(2)}) to your betslip`,
    });
  };

  const circuitsCodeSnippet = `import { SportyStakeSDK } from "@sportystake/sdk";

// Initialize Circuits Protocol Agent Worker
const agent = new CircuitsAgent({
  agentId: "circuit-sportystake-trader-01",
  walletPrivateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: "https://rpc.arc.network",
});

// Daily Execution Strategy Function
agent.onDailyCron(async () => {
  // 1. Fetch daily LLM AI analysis from SportyStake
  const analysis = await fetch("https://sportystake.com/api/ai-analytics").then(r => r.json());
  
  // 2. Filter high-confidence mispriced picks
  const sharpPicks = analysis.data.predictions.filter(
    (pick) => pick.confidence >= 75 && pick.valueBps >= 10
  );

  // 3. Autonomously place on-chain bets via BettingCore contract
  for (const item of sharpPicks) {
    console.log(\`[Circuits Agent] Executing \${item.pick} at \${item.odds}x (Confidence: \${item.confidence}%)\`);
    await agent.executeContractWrite({
      address: "0xBettingCoreAddress",
      functionName: "placeBet",
      args: [item.marketId, 0, 50000000n, BigInt(Math.floor(item.odds * 1000))], // $50 USDC stake
    });
  }
});`;

  const copyCircuitsCode = () => {
    navigator.clipboard.writeText(circuitsCodeSnippet);
    setCopiedCode(true);
    pushToast({ kind: "success", title: "Code Snippet Copied! 📋", body: "Circuits Protocol agent code copied to clipboard" });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-info)]/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="mono rounded-full bg-[var(--color-info)]/15 px-3 py-1 text-[11px] font-bold uppercase text-[var(--color-info)] ring-1 ring-[var(--color-info)]/30">
              DAILY LLM ENGINE · {modelUsed.toUpperCase()}
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              Top Football Leagues AI Edge
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Our daily LLM engine runs probabilistic xG, injury, and line-movement analysis exclusively across top-tier football leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League) once per day. Tail picks manually or automate execution using <strong>Circuits Protocol</strong>.
            </p>
          </div>

          {/* Sync Metadata */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 shadow-lg text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Daily Engine Model</p>
            <p className="mono text-sm font-black text-[var(--color-brand-500)] mt-0.5">{modelUsed}</p>
            <p className="text-[11px] text-[var(--color-ink-3)] mt-1">
              Last Sync: {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString() : "Today"}
            </p>
            <button
              onClick={() => fetchAnalysis(true)}
              className="mt-2 text-[10px] font-bold text-[var(--color-info)] hover:underline"
            >
              🔄 Trigger Daily Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex items-center gap-2 border-b border-[var(--color-line-1)] pb-3">
        <button
          onClick={() => setActiveTab("picks")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all ${
            activeTab === "picks"
              ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-md"
              : "bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white"
          }`}
        >
          <ZapIcon className="h-4 w-4" /> Daily LLM Predictions
        </button>
        <button
          onClick={() => setActiveTab("circuits")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all ${
            activeTab === "circuits"
              ? "bg-[var(--color-info)] text-[var(--color-bg-0)] shadow-md"
              : "bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white"
          }`}
        >
          🤖 Autonomous Agent Hub (Circuits Protocol)
        </button>
      </div>

      {activeTab === "picks" ? (
        <>
          {/* Insights Grid */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ZapIcon className="h-4 w-4 text-[var(--color-info)]" />
                Live Market Insights & Line Movements
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {insights.map((i, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-md">
                  <span
                    className="mono inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${i.accent}20`, color: i.accent }}
                  >
                    {i.tag}
                  </span>
                  <h3 className="mt-2 text-[14px] font-bold text-white">{i.title}</h3>
                  <p className="mt-1 text-[12px] text-[var(--color-ink-3)] leading-relaxed">{i.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Daily LLM Predictions List */}
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ZapIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
                Daily LLM Recommendations ({predictions.length})
              </span>
            </div>

            {loading ? (
              <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-bg-2)]" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {predictions.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                            {p.league}
                          </span>
                          <h3 className="text-base font-black text-white mt-0.5">{p.match}</h3>
                        </div>
                        <div className="text-right">
                          <span className="mono text-xs font-bold text-[var(--color-brand-500)]">
                            {p.confidence}% AI Confidence
                          </span>
                          <div className="mono text-[11px] text-[var(--color-ink-3)] mt-0.5">
                            Odds: <strong className="text-white">{p.odds.toFixed(2)}</strong> (Fair: {p.fair.toFixed(2)})
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)]">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Recommended Pick</span>
                            <p className="text-[14px] font-black text-white">{p.pick}</p>
                          </div>
                          <span className="mono rounded-lg bg-[var(--color-brand-500)]/15 px-3 py-1 text-[12px] font-black text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                            +{p.valueBps}% Edge
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] text-[var(--color-ink-2)] leading-relaxed">{p.reasoning}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {p.factors?.map((f: string, idx: number) => (
                          <span key={idx} className="mono rounded-md bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-ink-3)]">
                            #{f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-[var(--color-line-1)] pt-3">
                      <button
                        onClick={() => handleTailPick(p)}
                        className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] px-5 py-2 text-[12px] font-bold text-[var(--color-bg-0)] shadow-md hover:bg-[var(--color-brand-400)] transition-all active:scale-95"
                      >
                        <CopyIcon className="h-3.5 w-3.5" /> Tail AI Pick
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* Circuits Protocol Integration Section */
        <section className="mt-6 space-y-6">
          <div className="rounded-2xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/5 p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-info)]/20 text-[var(--color-info)] ring-1 ring-[var(--color-info)]/40 text-2xl">
                🤖
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">
                  Autonomous Agent Betting Hub via Circuits Protocol
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-ink-2)] max-w-2xl">
                  SportyStake sportsbook, prediction markets, and casino games are fully compatible with <strong>Circuits Protocol</strong> (<code className="mono text-white">app.circuitsprotocol.com</code>). You can deploy autonomous AI trading agents to automatically poll AI picks and execute on-chain bets.
                </p>
              </div>
            </div>
          </div>

          {/* Practical Step-by-Step Setup Guide */}
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Practical Steps to Setup an Autonomous Betting Agent</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
                <span className="mono flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-info)]/20 text-xs font-black text-[var(--color-info)] mb-3">
                  01
                </span>
                <h4 className="text-[14px] font-bold text-white">Deploy Agent Worker</h4>
                <p className="mt-1 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
                  Log into <strong>Circuits Protocol</strong> (<code className="mono text-white">app.circuitsprotocol.com</code>) and launch a new Autonomous Trading Agent worker.
                </p>
              </div>

              <div className="rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
                <span className="mono flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-info)]/20 text-xs font-black text-[var(--color-info)] mb-3">
                  02
                </span>
                <h4 className="text-[14px] font-bold text-white">Set AI Confidence Rules</h4>
                <p className="mt-1 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
                  Configure execution thresholds (e.g. execute bet only when AI pick confidence &gt;= 75% and value edge &gt;= 10%).
                </p>
              </div>

              <div className="rounded-xl bg-[var(--color-bg-1)] p-4 border border-[var(--color-line-1)]">
                <span className="mono flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-info)]/20 text-xs font-black text-[var(--color-info)] mb-3">
                  03
                </span>
                <h4 className="text-[14px] font-bold text-white">Automate On-Chain Bets</h4>
                <p className="mt-1 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
                  Supply your agent worker with your SportyStake session or wallet key. The agent executes on-chain bets automatically 24/7.
                </p>
              </div>
            </div>
          </div>

          {/* Copyable Agent Code Template */}
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Circuits Protocol Agent Worker Code</h3>
                <p className="text-[11px] text-[var(--color-ink-3)]">Copyable TypeScript snippet for autonomous cron execution</p>
              </div>
              <button
                onClick={copyCircuitsCode}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-info)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)]"
              >
                <CopyIcon className="h-3.5 w-3.5" /> {copiedCode ? "Copied!" : "Copy Code Snippet"}
              </button>
            </div>

            <pre className="mono rounded-xl bg-[var(--color-bg-0)] p-4 text-[12px] text-[var(--color-brand-500)] overflow-x-auto border border-[var(--color-line-1)]">
              {circuitsCodeSnippet}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
