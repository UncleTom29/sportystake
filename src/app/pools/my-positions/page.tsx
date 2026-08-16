"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { Liquidity } from "@/lib/api-client";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { clientEnv } from "@/lib/env";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { privyApproveIfNeeded, privyContractWrite } from "@/lib/privyTx";
import { parseUsdc } from "../../../../packages/sdk/src/utils";
import { useNotifications } from "@/lib/notificationStore";
import type { PoolStats, LPPositionDTO } from "@/lib/types";
import {
  ShieldIcon,
  ChevronLeft,
} from "@/components/icons/UIIcons";

type Step = "idle" | "approving" | "signing" | "confirming";

export default function MyPositionsPage() {
  const address = useWallet((s) => s.address);
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();
  const pushToast = useNotifications((s) => s.pushToast);

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<LPPositionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [step, setStep] = useState<Step>("idle");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [poolRes, posRes] = await Promise.all([
        Liquidity.pool().catch(() => null),
        isAuthenticated ? Liquidity.myPositions().catch(() => null) : Promise.resolve(null),
      ]);
      if (poolRes) setPool(poolRes.pool);
      setPosition(posRes?.items[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const liquidityPoolContract = (CONTRACT_ADDRESSES.liquidityPool ||
    clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS) as `0x${string}`;
  const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as `0x${string}`;

  const handleDeposit = async () => {
    if (!isAuthenticated) {
      void signIn();
      return;
    }
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !address) return;

    try {
      const amountRaw = parseUsdc(depositAmount);
      setStep("approving");
      await privyApproveIfNeeded({ token: usdc, owner: address, spender: liquidityPoolContract, amount: amountRaw });
      setStep("signing");
      const receipt = await privyContractWrite({
        contractAddress: liquidityPoolContract,
        abiFunctionSignature: "deposit(uint256)",
        abiParameters: [amountRaw],
      });
      setStep("confirming");
      await Liquidity.deposit(depositAmount, receipt.transactionHash);
      setDepositAmount("");
      pushToast({ kind: "success", title: "Deposit Confirmed! 💧", body: `Added ${depositAmount} USDC to liquidity pool` });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Deposit Failed", body: (e as Error).message });
    } finally {
      setStep("idle");
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!address) return;
    try {
      setStep("signing");
      const receipt = await privyContractWrite({
        contractAddress: liquidityPoolContract,
        abiFunctionSignature: "requestWithdrawal()",
        abiParameters: [],
      });
      setStep("confirming");
      await Liquidity.requestWithdraw();
      pushToast({ kind: "success", title: "Withdrawal Requested", body: "Timelock started. You can execute withdrawal after timelock expires." });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Request Failed", body: (e as Error).message });
    } finally {
      setStep("idle");
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!address) return;
    try {
      setStep("signing");
      const receipt = await privyContractWrite({
        contractAddress: liquidityPoolContract,
        abiFunctionSignature: "executeWithdrawal()",
        abiParameters: [],
      });
      setStep("confirming");
      await Liquidity.executeWithdraw(receipt.transactionHash);
      pushToast({ kind: "success", title: "Withdrawal Executed! 💰", body: "USDC returned to your wallet" });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Execution Failed", body: (e as Error).message });
    } finally {
      setStep("idle");
    }
  };

  const currentVal = position ? parseFloat(position.currentValueUsdc ?? position.depositedUsdc ?? "0") : 0;
  const depositedVal = position ? parseFloat(position.depositedUsdc ?? "0") : 0;
  const yieldVal = Math.max(0, currentVal - depositedVal);

  const poolTvl = pool ? parseFloat(pool.tvl ?? "0") : 0;
  const ownershipPct = poolTvl > 0 && currentVal > 0 ? ((currentVal / poolTvl) * 100).toFixed(2) : "0.00";

  return (
    <div className="mx-auto max-w-[1200px] px-3 py-5 md:px-5">
      {/* Breadcrumb Navigation */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/pools" className="flex items-center gap-1 hover:text-white transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          Liquidity Pools
        </Link>
        <span>/</span>
        <span className="text-white font-semibold">My Positions</span>
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,231,1,0.1),transparent_65%)]" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="mono rounded-full bg-[var(--color-brand-500)]/15 px-3 py-1 text-[11px] font-bold uppercase text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
              PROTOCOL LIQUIDITY PROVIDER
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              My Liquidity Position & Yield
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)] max-w-xl">
              Track your shared pool ownership, live USDC valuation, house-edge yield accrual, and withdrawal timelock status.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/pools"
              className="rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)] transition-all"
            >
              Browse All Pools
            </Link>
          </div>
        </div>
      </div>

      {/* Authentication Guard */}
      {!isAuthenticated ? (
        <div className="mt-6 rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-12 text-center shadow-xl">
          <ShieldIcon className="mx-auto h-12 w-12 text-[var(--color-brand-500)] mb-3" />
          <h3 className="text-lg font-bold text-white">Connect Wallet to View LP Positions</h3>
          <p className="mt-1 text-[13px] text-[var(--color-ink-3)] max-w-md mx-auto">
            Connect your wallet to inspect your on-chain LP tokens, track earned yield, or manage liquidity deposits.
          </p>
          <button
            onClick={() => void signIn()}
            className="mt-5 rounded-xl bg-[var(--color-brand-500)] px-6 py-3 text-[13px] font-bold text-[var(--color-bg-0)] shadow-lg hover:bg-[var(--color-brand-400)] transition-all"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Position Value</span>
              <p className="mono mt-1 text-2xl font-black text-[var(--color-brand-500)]">
                {loading ? "—" : `$${currentVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </p>
              <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">USDC Valuation</p>
            </div>

            <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">All-Time Yield</span>
              <p className="mono mt-1 text-2xl font-black text-[var(--color-warn)]">
                {loading ? "—" : `+$${yieldVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </p>
              <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">House Edge Accrued</p>
            </div>

            <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Pool Ownership</span>
              <p className="mono mt-1 text-2xl font-black text-[var(--color-info)]">
                {loading ? "—" : `${ownershipPct}%`}
              </p>
              <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">Shared Protocol Pool</p>
            </div>
          </div>

          {/* Interactive Deposit / Withdraw Management */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* Left: Position & Actions */}
            <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between border-b border-[var(--color-line-1)] pb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("deposit")}
                    className={`rounded-xl px-4 py-2 text-[12px] font-bold transition-all ${
                      activeTab === "deposit"
                        ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow"
                        : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)] hover:text-white"
                    }`}
                  >
                    + Deposit Liquidity
                  </button>
                  <button
                    onClick={() => setActiveTab("withdraw")}
                    className={`rounded-xl px-4 py-2 text-[12px] font-bold transition-all ${
                      activeTab === "withdraw"
                        ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow"
                        : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)] hover:text-white"
                    }`}
                  >
                    Withdraw Liquidity
                  </button>
                </div>
              </div>

              {activeTab === "deposit" ? (
                <div className="space-y-4">
                  <p className="text-[13px] text-[var(--color-ink-2)]">
                    Deposit USDC into the shared house pool. You earn house-edge revenue from all sportsbook and casino bets proportional to your share.
                  </p>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                      Deposit Amount (USDC)
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="100.00"
                        className="mono h-12 w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-4 pr-20 text-base font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
                      />
                      <button
                        onClick={() => setDepositAmount("500")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--color-bg-3)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-500)] hover:bg-[var(--color-bg-4)]"
                      >
                        $500
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleDeposit}
                    disabled={step !== "idle" || !depositAmount || parseFloat(depositAmount) <= 0}
                    className="w-full rounded-xl bg-[var(--color-brand-500)] py-3 text-sm font-bold text-[var(--color-bg-0)] shadow-lg hover:bg-[var(--color-brand-400)] disabled:opacity-40 transition-all"
                  >
                    {step === "approving"
                      ? "Approving USDC…"
                      : step === "signing"
                      ? "Signing Transaction…"
                      : step === "confirming"
                      ? "Confirming on Arc…"
                      : "Deposit USDC & Mint LP Tokens"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[13px] text-[var(--color-ink-2)]">
                    Liquidity withdrawals follow a 2-step process: request withdrawal to start the timelock, then execute withdrawal once unlocked.
                  </p>

                  {position?.status === "WITHDRAW_REQUESTED" ? (
                    <div className="rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-4">
                      <p className="text-[13px] font-bold text-[var(--color-warn)]">Withdrawal Request Pending</p>
                      <p className="mt-1 text-[12px] text-[var(--color-ink-2)]">
                        Status: <strong className="text-white">WITHDRAW_REQUESTED</strong>
                      </p>
                      <button
                        onClick={handleExecuteWithdrawal}
                        disabled={step !== "idle"}
                        className="mt-3 rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)]"
                      >
                        Execute Withdrawal Now
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4">
                      <p className="text-[12px] font-bold text-white">Start Withdrawal Timelock</p>
                      <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                        Current LP Valuation: <strong className="text-white">${currentVal.toFixed(2)} USDC</strong>
                      </p>
                      <button
                        onClick={handleRequestWithdrawal}
                        disabled={step !== "idle" || currentVal <= 0}
                        className="mt-3 rounded-lg bg-[var(--color-bg-3)] px-4 py-2 text-[12px] font-bold text-white hover:bg-[var(--color-bg-4)] disabled:opacity-40"
                      >
                        Request Withdrawal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Pool Health Summary */}
            <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
                Global Pool Health
              </h3>

              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between border-b border-[var(--color-line-1)] pb-2">
                  <span className="text-[var(--color-ink-3)]">Total Pool TVL</span>
                  <span className="mono font-bold text-white">
                    ${pool ? parseFloat(pool.tvl ?? "0").toLocaleString() : "0"} USDC
                  </span>
                </div>

                <div className="flex justify-between border-b border-[var(--color-line-1)] pb-2">
                  <span className="text-[var(--color-ink-3)]">Locked Collateral</span>
                  <span className="mono font-bold text-[var(--color-warn)]">
                    ${pool ? parseFloat(pool.locked ?? "0").toLocaleString() : "0"} USDC
                  </span>
                </div>

                <div className="flex justify-between border-b border-[var(--color-line-1)] pb-2">
                  <span className="text-[var(--color-ink-3)]">Effective Capacity</span>
                  <span className="mono font-bold text-[var(--color-info)]">
                    ${pool ? parseFloat(pool.effectiveCapacity ?? "0").toLocaleString() : "0"} USDC
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-3)]">House Edge Fee Share</span>
                  <span className="mono font-bold text-[var(--color-brand-500)]">85% to LPs</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
