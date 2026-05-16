"use client";
import { useState } from "react";
import { liquidityPools } from "@/lib/mockData";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

function formatNumber(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export default function PoolsPage() {
  const [activePool, setActivePool] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");

  const totalTVL = liquidityPools.reduce((s, p) => s + p.tvl, 0);
  const avgApy = liquidityPools.reduce((s, p) => s + p.apy, 0) / liquidityPools.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d2a1f] to-[#0d1f35] rounded-3xl p-8 mb-6 border border-green-500/20">
        <div className="relative z-10">
          <Badge variant="green">💧 Liquidity Pools</Badge>
          <h1 className="text-3xl font-black mt-3 mb-2">Earn from the House Edge</h1>
          <p className="text-gray-400 max-w-xl">
            Provide liquidity to SportyStake&apos;s decentralized treasury and earn a share of sportsbook and casino profits. Transparent. Non-custodial. Real yield.
          </p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl opacity-10">💧</div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Value Locked", value: formatNumber(totalTVL), icon: "🏦" },
          { label: "Avg APY", value: `${avgApy.toFixed(1)}%`, icon: "📈" },
          { label: "Active LPs", value: "1,284", icon: "👥" },
          { label: "Paid Out (30d)", value: "$48,200", icon: "💸" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111e2d] border border-white/5 rounded-2xl p-4">
            <p className="text-lg mb-1">{s.icon}</p>
            <p className="text-xl font-black text-white">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* My position */}
      <div className="bg-[#111e2d] border border-white/10 rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-400 mb-3">My Position</p>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-black text-white">$5,000.00</p>
              <p className="text-xs text-gray-500">Total Staked</p>
            </div>
            <div>
              <p className="text-2xl font-black text-green-400">$62.30</p>
              <p className="text-xs text-gray-500">Earnings (7d)</p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-400">12.4%</p>
              <p className="text-xs text-gray-500">Current APY</p>
            </div>
          </div>
          <Button variant="secondary">Withdraw</Button>
        </div>
      </div>

      {/* Pools list */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-400">Available Pools</p>
        {liquidityPools.map((pool) => (
          <div
            key={pool.id}
            className="bg-[#111e2d] border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-colors"
          >
            <div className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 font-black text-sm">
                    {pool.asset}
                  </div>
                  <div>
                    <p className="font-bold text-white">{pool.name}</p>
                    <p className="text-xs text-gray-500">
                      TVL: {formatNumber(pool.tvl)} · 24h Vol: {formatNumber(pool.volume24h)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xl font-black text-green-400">{pool.apy}%</p>
                    <p className="text-xs text-gray-500">APY</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-xl font-black text-white">{formatNumber(pool.tvl)}</p>
                    <p className="text-xs text-gray-500">TVL</p>
                  </div>
                  {pool.myStake > 0 && (
                    <div className="text-center hidden sm:block">
                      <p className="text-xl font-black text-blue-400">${pool.myStake.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">My Stake</p>
                    </div>
                  )}
                  <Button
                    variant={activePool === pool.id ? "danger" : "primary"}
                    size="sm"
                    onClick={() => setActivePool(activePool === pool.id ? null : pool.id)}
                  >
                    {activePool === pool.id ? "Cancel" : pool.myStake > 0 ? "Add More" : "Deposit"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Deposit panel */}
            {activePool === pool.id && (
              <div className="border-t border-white/5 bg-[#0d1821] p-5">
                <p className="text-sm font-semibold mb-3">Deposit to {pool.name}</p>
                <div className="flex gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">
                      {pool.asset}
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="w-full bg-[#1a2738] border border-white/10 rounded-xl pl-14 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="flex gap-1">
                    {["100", "500", "1000"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setStakeAmount(v)}
                        className="px-3 py-2 rounded-lg bg-[#1a2738] hover:bg-[#243447] text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                  <Button variant="primary">
                    Deposit {stakeAmount ? `$${stakeAmount}` : ""}
                  </Button>
                </div>
                {stakeAmount && parseFloat(stakeAmount) > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Est. monthly earnings:{" "}
                    <span className="text-green-400 font-semibold">
                      ${((parseFloat(stakeAmount) * pool.apy) / 100 / 12).toFixed(2)} {pool.asset}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Explainer */}
      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        {[
          { icon: "🔐", title: "Non-Custodial", desc: "Funds stay in smart contracts, not on our balance sheet. Withdraw anytime." },
          { icon: "📊", title: "Transparent Yield", desc: "Earnings come from sportsbook margin and casino house edge — publicly verifiable." },
          { icon: "⚡", title: "Instant Withdrawals", desc: "Withdraw your stake and accumulated earnings at any time with no lock-up period." },
        ].map((f) => (
          <div key={f.title} className="bg-[#111e2d] border border-white/5 rounded-2xl p-5">
            <span className="text-2xl block mb-2">{f.icon}</span>
            <p className="font-bold text-sm mb-1">{f.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
