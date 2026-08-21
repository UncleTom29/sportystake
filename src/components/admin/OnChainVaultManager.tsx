"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldIcon,
  ZapIcon,
  TrophyIcon,
  CloseIcon,
} from "@/components/icons/UIIcons";
import { useNotifications } from "@/lib/notificationStore";

interface LiquidityData {
  operator: {
    address: string | null;
    gasBalance: number;
    usdcBalance: number;
  };
  sportsPool: {
    address: string;
    vaultBalance: number;
    tvl: number;
    totalShares: string;
    virtualLiquidity: number;
    lockedForPayouts: number;
    effectiveCapacity: number;
    unlockedLiquidity: number;
    operatorShares: string;
    operatorPositionValue: number;
    operatorMaxWithdrawable: number;
    timelockSeconds: number;
    timelockStatus: "none" | "active" | "expired";
    timelockRemainingSecs: number;
  };
  casinoHouse: {
    address: string;
    vaultBalance: number;
    pendingExposure: number;
    maxWithdrawable: number;
    rtpPercent: number;
  };
  crashGame: {
    address: string;
    vaultBalance: number;
    pendingPayouts: number;
    roundReserved: number;
    totalReserved: number;
    maxWithdrawable: number;
    currentRoundId: number;
    rtpPercent: number;
  };
  totalProtocolUsdc: number;
}

function shortAddr(addr?: string | null) {
  if (!addr) return "N/A";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(val: number): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "Ready to execute";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

export default function OnChainVaultManager() {
  const pushToast = useNotifications((s) => s.pushToast);
  const [data, setData] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw" | null>(null);
  const [activeVault, setActiveVault] = useState<"sports" | "casino" | "crash">("sports");
  const [amountInput, setAmountInput] = useState<string>("");
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const fetchLiquidity = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/liquidity", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch on-chain liquidity");
      const json = await res.json();
      if (json?.data) {
        setData(json.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiquidity();
    const interval = setInterval(fetchLiquidity, 15000);
    return () => clearInterval(interval);
  }, [fetchLiquidity]);

  const handleDeposit = async () => {
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      pushToast({ kind: "error", title: "Invalid Amount", body: "Please enter a valid deposit amount." });
      return;
    }

    setSubmitting(true);
    setLastTxHash(null);

    try {
      const res = await fetch("/api/admin/liquidity/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vault: activeVault, amountUsdc: amt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Deposit transaction failed");

      setLastTxHash(json.data?.txHash || null);
      pushToast({
        kind: "success",
        title: "On-Chain Deposit Confirmed! 🚀",
        body: `$${amt.toLocaleString()} USDC deposited to ${activeVault.toUpperCase()} vault in block ${json.data?.blockNumber}`,
      });
      setAmountInput("");
      setModalMode(null);
      await fetchLiquidity();
    } catch (err: any) {
      pushToast({ kind: "error", title: "Deposit Failed", body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (action: "request" | "execute" = "execute") => {
    let amt: number | undefined = undefined;
    if (activeVault !== "sports" || action === "execute") {
      if (activeVault !== "sports") {
        amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
          pushToast({ kind: "error", title: "Invalid Amount", body: "Please enter a valid withdrawal amount." });
          return;
        }
      }
    }

    setSubmitting(true);
    setLastTxHash(null);

    try {
      const res = await fetch("/api/admin/liquidity/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault: activeVault,
          action,
          amountUsdc: amt,
          recipient: recipientInput.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Withdrawal transaction failed");

      setLastTxHash(json.data?.txHash || null);
      pushToast({
        kind: "success",
        title: "On-Chain Withdrawal Success! 💸",
        body: json.data?.message || `Withdrawal executed successfully in block ${json.data?.blockNumber}`,
      });
      setAmountInput("");
      setRecipientInput("");
      setModalMode(null);
      await fetchLiquidity();
    } catch (err: any) {
      pushToast({ kind: "error", title: "Withdrawal Failed", body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 animate-pulse">
        <div className="h-6 w-48 bg-[var(--color-bg-3)] rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-44 bg-[var(--color-bg-1)] rounded-xl" />
          <div className="h-44 bg-[var(--color-bg-1)] rounded-xl" />
          <div className="h-44 bg-[var(--color-bg-1)] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner & Operator Wallet Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-[var(--color-line-2)] bg-gradient-to-r from-[var(--color-bg-2)] via-[var(--color-bg-2)] to-[var(--color-bg-3)] p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              Protocol On-Chain Vaults & Bankroll Manager
            </h2>
          </div>
          <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
            Direct Arc Network smart contract liquidity funding, reserves monitoring, and timelocked withdrawals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* Operator Address & Balances */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-1.5 text-xs shadow-inner">
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Operator Signer</p>
              <p className="mono font-bold text-white text-[11px]">{shortAddr(data?.operator.address)}</p>
            </div>
            <div className="h-6 w-px bg-[var(--color-line-1)] mx-1" />
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">Gas (Arc)</p>
              <p className="mono font-bold text-cyan-400 text-[11px]">{data?.operator.gasBalance.toFixed(2)} GAS</p>
            </div>
            <div className="h-6 w-px bg-[var(--color-line-1)] mx-1" />
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">USDC</p>
              <p className="mono font-bold text-[var(--color-brand-500)] text-[11px]">
                ${data ? formatUsd(data.operator.usdcBalance) : "0.00"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchLiquidity();
            }}
            disabled={refreshing}
            className="flex h-9 items-center justify-center rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 text-xs font-semibold text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)] hover:text-white transition-all active:scale-95"
            title="Refresh On-Chain Balances"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* 3 Main Protocol Vault Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Vault 1: Sports Betting Pool */}
        <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-md flex flex-col justify-between hover:border-[var(--color-brand-500)]/40 transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/15 text-base">
                  ⚽
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Sports Betting Pool</h3>
                  <p className="mono text-[10px] text-[var(--color-ink-3)]">
                    {shortAddr(data?.sportsPool.address)}
                  </p>
                </div>
              </div>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 mono text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                Shared LP
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Contract USDC Vault:</span>
                <span className="mono font-bold text-white text-sm">
                  ${data ? formatUsd(data.sportsPool.vaultBalance) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Real Deposited TVL:</span>
                <span className="mono font-bold text-emerald-400">
                  ${data ? formatUsd(data.sportsPool.tvl) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Virtual Credit:</span>
                <span className="mono font-bold text-[var(--color-brand-500)]">
                  +${data ? formatUsd(data.sportsPool.virtualLiquidity) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Locked for Open Bets:</span>
                <span className="mono font-bold text-amber-400">
                  ${data ? formatUsd(data.sportsPool.lockedForPayouts) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--color-line-1)]/50 pt-2">
                <span className="text-[var(--color-ink-3)]">Free LP Unlocked:</span>
                <span className="mono font-bold text-cyan-400">
                  ${data ? formatUsd(data.sportsPool.unlockedLiquidity) : "0.00"}
                </span>
              </div>

              {/* Operator Position Box */}
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-[var(--color-ink-2)]">Operator LP Position:</span>
                  <span className="mono font-black text-white">
                    ${data ? formatUsd(data.sportsPool.operatorPositionValue) : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-[var(--color-ink-3)]">
                  <span>Withdrawal Timelock:</span>
                  <span className="mono font-semibold text-amber-400">
                    {data?.sportsPool.timelockStatus === "none"
                      ? "48h Cooldown required"
                      : data?.sportsPool.timelockStatus === "active"
                      ? `⏳ ${formatTime(data.sportsPool.timelockRemainingSecs)} remaining`
                      : "🟢 Cooldown Expired (Ready)"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                setActiveVault("sports");
                setModalMode("deposit");
              }}
              className="flex-1 rounded-xl bg-[var(--color-brand-500)] py-2 text-xs font-black text-[var(--color-bg-0)] hover:brightness-110 transition-all shadow-sm active:scale-95"
            >
              + Deposit USDC
            </button>

            {data?.sportsPool.timelockStatus === "expired" ? (
              <button
                onClick={() => handleWithdraw("execute")}
                disabled={submitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-black text-black hover:brightness-110 transition-all shadow-sm active:scale-95"
              >
                {submitting ? "Processing..." : "💸 Withdraw LP"}
              </button>
            ) : data?.sportsPool.timelockStatus === "active" ? (
              <button
                disabled
                className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-400 cursor-not-allowed opacity-80"
              >
                ⏳ Cooldown Active
              </button>
            ) : (
              <button
                onClick={() => handleWithdraw("request")}
                disabled={submitting || (data?.sportsPool.operatorPositionValue || 0) <= 0}
                className="flex-1 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-3)] py-2 text-xs font-bold text-white hover:bg-[var(--color-bg-1)] transition-all active:scale-95 disabled:opacity-40"
              >
                {submitting ? "..." : "⏳ Request Exit"}
              </button>
            )}
          </div>
        </div>

        {/* Vault 2: Casino House Vault */}
        <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-md flex flex-col justify-between hover:border-purple-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-base">
                  🎲
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Casino House Vault</h3>
                  <p className="mono text-[10px] text-[var(--color-ink-3)]">
                    {shortAddr(data?.casinoHouse.address)}
                  </p>
                </div>
              </div>
              <span className="rounded bg-purple-500/10 px-2 py-0.5 mono text-[10px] font-bold text-purple-400 border border-purple-500/20">
                Single-Player
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Bankroll Vault USDC:</span>
                <span className="mono font-bold text-white text-sm">
                  ${data ? formatUsd(data.casinoHouse.vaultBalance) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Pending Game Exposure:</span>
                <span className="mono font-bold text-amber-400">
                  ${data ? formatUsd(data.casinoHouse.pendingExposure) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Max Withdrawable:</span>
                <span className="mono font-bold text-emerald-400">
                  ${data ? formatUsd(data.casinoHouse.maxWithdrawable) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--color-line-1)]/50 pt-2">
                <span className="text-[var(--color-ink-3)]">House RTP Setting:</span>
                <span className="mono font-bold text-cyan-400">
                  {data?.casinoHouse.rtpPercent.toFixed(2)}% ({(100 - (data?.casinoHouse.rtpPercent || 90)).toFixed(2)}% Edge)
                </span>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 mt-4 text-[11px] text-[var(--color-ink-2)]">
                Backs dice, blackjack, roulette, slots, and baccarat wagers. Payouts are settled sub-second directly to winning players.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                setActiveVault("casino");
                setModalMode("deposit");
              }}
              className="flex-1 rounded-xl bg-purple-500 py-2 text-xs font-black text-white hover:brightness-110 transition-all shadow-sm active:scale-95"
            >
              + Deposit Bankroll
            </button>
            <button
              onClick={() => {
                setActiveVault("casino");
                setModalMode("withdraw");
              }}
              disabled={(data?.casinoHouse.maxWithdrawable || 0) <= 0}
              className="flex-1 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-3)] py-2 text-xs font-bold text-white hover:bg-[var(--color-bg-1)] transition-all active:scale-95 disabled:opacity-40"
            >
              💸 Withdraw
            </button>
          </div>
        </div>

        {/* Vault 3: Crash Game Vault */}
        <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-md flex flex-col justify-between hover:border-rose-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-base">
                  🚀
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Crash Game Vault</h3>
                  <p className="mono text-[10px] text-[var(--color-ink-3)]">
                    {shortAddr(data?.crashGame.address)}
                  </p>
                </div>
              </div>
              <span className="rounded bg-rose-500/10 px-2 py-0.5 mono text-[10px] font-bold text-rose-400 border border-rose-500/20">
                Multi-Player
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Bankroll Vault USDC:</span>
                <span className="mono font-bold text-white text-sm">
                  ${data ? formatUsd(data.crashGame.vaultBalance) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Pending & Round Reserved:</span>
                <span className="mono font-bold text-amber-400">
                  ${data ? formatUsd(data.crashGame.totalReserved) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-ink-3)]">Max Withdrawable:</span>
                <span className="mono font-bold text-emerald-400">
                  ${data ? formatUsd(data.crashGame.maxWithdrawable) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--color-line-1)]/50 pt-2">
                <span className="text-[var(--color-ink-3)]">Current Round ID:</span>
                <span className="mono font-bold text-white">
                  #{data?.crashGame.currentRoundId}
                </span>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 mt-4 text-[11px] text-[var(--color-ink-2)]">
                Backs synchronous multi-player rocket rounds with commit-reveal server seeds and auto-cashout caps.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                setActiveVault("crash");
                setModalMode("deposit");
              }}
              className="flex-1 rounded-xl bg-rose-500 py-2 text-xs font-black text-white hover:brightness-110 transition-all shadow-sm active:scale-95"
            >
              + Deposit Bankroll
            </button>
            <button
              onClick={() => {
                setActiveVault("crash");
                setModalMode("withdraw");
              }}
              disabled={(data?.crashGame.maxWithdrawable || 0) <= 0}
              className="flex-1 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-3)] py-2 text-xs font-bold text-white hover:bg-[var(--color-bg-1)] transition-all active:scale-95 disabled:opacity-40"
            >
              💸 Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Protocol Total Banner */}
      <div className="rounded-2xl border border-[var(--color-brand-500)]/30 bg-gradient-to-r from-[var(--color-bg-2)] via-[var(--color-brand-500)]/5 to-[var(--color-bg-2)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/20 text-lg">
            🏛️
          </div>
          <div>
            <p className="text-[11px] uppercase font-bold tracking-wider text-[var(--color-ink-3)]">
              Combined Total Protocol On-Chain USDC Liquidity
            </p>
            <p className="mono text-2xl font-black text-white">
              ${data ? formatUsd(data.totalProtocolUsdc) : "0.00"} <span className="text-xs font-bold text-[var(--color-brand-500)]">USDC</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--color-ink-3)] max-w-sm">
          Backed 100% on Arc Network across audited smart contracts. Zero central custodial risk.
        </p>
      </div>

      {/* Interactive Modal for Deposit / Withdraw */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                {modalMode === "deposit" ? "📥 Deposit Liquidity" : "📤 Withdraw Liquidity"}
                <span className="rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-xs text-[var(--color-brand-500)] font-bold uppercase">
                  {activeVault}
                </span>
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="rounded-lg p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-bg-3)] hover:text-white"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--color-ink-2)] mb-1">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 py-2.5 text-sm font-bold text-white focus:border-[var(--color-brand-500)] focus:outline-none mono"
                  />
                  {modalMode === "withdraw" && (
                    <button
                      onClick={() => {
                        if (activeVault === "casino" && data) {
                          setAmountInput(data.casinoHouse.maxWithdrawable.toString());
                        } else if (activeVault === "crash" && data) {
                          setAmountInput(data.crashGame.maxWithdrawable.toString());
                        }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-[var(--color-bg-3)] px-2 py-1 text-[10px] font-black text-[var(--color-brand-500)] hover:bg-[var(--color-bg-2)]"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              {modalMode === "deposit" && (
                <div className="flex gap-2">
                  {[50, 100, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountInput(preset.toString())}
                      className="flex-1 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-1 text-xs font-semibold text-[var(--color-ink-2)] hover:text-white hover:border-[var(--color-brand-500)] transition-all"
                    >
                      +${preset}
                    </button>
                  ))}
                </div>
              )}

              {modalMode === "withdraw" && activeVault !== "sports" && (
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink-2)] mb-1">
                    Destination Address (Optional — Defaults to Operator)
                  </label>
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    placeholder={data?.operator.address || "0x..."}
                    className="w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 py-2 text-xs font-mono text-white focus:border-[var(--color-brand-500)] focus:outline-none"
                  />
                </div>
              )}

              <p className="text-[11px] text-[var(--color-ink-3)] bg-[var(--color-bg-1)] p-3 rounded-xl border border-[var(--color-line-1)]">
                {modalMode === "deposit"
                  ? `USDC will be transferred on-chain from the operator wallet (${shortAddr(data?.operator.address)}) into the ${activeVault.toUpperCase()} contract.`
                  : `USDC will be withdrawn on-chain from the ${activeVault.toUpperCase()} vault back to the designated destination address.`}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="flex-1 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-2.5 text-xs font-bold text-[var(--color-ink-2)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={modalMode === "deposit" ? handleDeposit : () => handleWithdraw("execute")}
                className="flex-1 rounded-xl bg-[var(--color-brand-500)] py-2.5 text-xs font-black text-[var(--color-bg-0)] hover:brightness-110 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Confirming on Arc..." : modalMode === "deposit" ? "Confirm Deposit" : "Confirm Withdrawal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
