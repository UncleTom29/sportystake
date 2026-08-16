"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { Liquidity } from "@/lib/api-client";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { clientEnv } from "@/lib/env";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { privyApproveIfNeeded, privyContractWrite } from "@/lib/privyTx";
import { parseUsdc } from "../../../packages/sdk/src/utils";
import { useNotifications } from "@/lib/notificationStore";
import type { PoolStats, LPPositionDTO } from "@/lib/types";
import {
  ShieldIcon,
  ZapIcon,
  ChevronDown,
  UsdcIcon,
  TrendUp,
  ArrowUpRight,
} from "@/components/icons/UIIcons";

type TxStep = "idle" | "approving" | "signing" | "confirming";

export default function LPAmountDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const address = useWallet((s) => s.address);
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();
  const pushToast = useNotifications((s) => s.pushToast);

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<LPPositionDTO | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [txStep, setTxStep] = useState<TxStep>("idle");

  const refreshData = useCallback(async () => {
    try {
      const [poolRes, posRes] = await Promise.all([
        Liquidity.pool().catch(() => null),
        isAuthenticated ? Liquidity.myPositions().catch(() => null) : Promise.resolve(null),
      ]);
      if (poolRes) setPool(poolRes.pool);
      setPosition(posRes?.items[0] ?? null);
    } catch {
      // Fall back to default metrics
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Total pool capacity calculation
  const totalPoolCapacityUsdc = pool
    ? Number(pool.effectiveCapacity || pool.tvl)
    : 5075000;
  const poolLpDisplay = formatUsd(totalPoolCapacityUsdc > 0 ? totalPoolCapacityUsdc : 5075000);

  const liquidityPoolContract = (CONTRACT_ADDRESSES.liquidityPool ||
    clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS) as `0x${string}`;
  const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as `0x${string}`;

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      void signIn();
      return;
    }
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !address) return;

    try {
      const amountRaw = parseUsdc(depositAmount);
      setTxStep("approving");
      await privyApproveIfNeeded({
        token: usdc,
        owner: address,
        spender: liquidityPoolContract,
        amount: amountRaw,
      });

      setTxStep("signing");
      const receipt = await privyContractWrite({
        contractAddress: liquidityPoolContract,
        abiFunctionSignature: "deposit(uint256)",
        abiParameters: [amountRaw],
      });

      setTxStep("confirming");
      await Liquidity.deposit(depositAmount, receipt.transactionHash);

      pushToast({
        kind: "success",
        title: "LP Deposit Successful! 💰",
        body: `Deposited $${depositAmount} USDC into the house liquidity pool.`,
      });

      setDepositAmount("");
      setTxStep("idle");
      void refreshData();
    } catch (err: any) {
      setTxStep("idle");
      pushToast({
        kind: "error",
        title: "Deposit Failed",
        body: err?.message || "Transaction reverted or failed",
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Header Trigger Pill — compact (icon + value only) below sm, full
          "LP $X ▾" label from sm up. Previously hidden entirely below md,
          which meant every mobile visitor lost access to the LP pool
          dropdown from the top nav. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Liquidity Pool Dropdown"
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1 text-xs font-semibold transition-all duration-200 shadow-sm ${
          open
            ? "border-[var(--color-brand-500)] bg-[var(--color-bg-3)] text-white ring-2 ring-[var(--color-brand-500)]/20"
            : "border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] text-[var(--color-ink-1)] hover:border-[var(--color-brand-500)] hover:bg-[var(--color-bg-3)] hover:text-white"
        }`}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]">
          <ShieldIcon className="h-3.5 w-3.5" />
        </div>
        <span className="mono text-[11px] font-bold tracking-tight text-white">
          <span className="hidden sm:inline">LP </span><span className="text-[var(--color-brand-500)]">{poolLpDisplay}</span>
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-[var(--color-ink-3)] transition-transform duration-200 sm:block ${
            open ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]">
                <ShieldIcon className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Protocol Liquidity Pool</h4>
                <p className="text-[10px] text-[var(--color-ink-3)]">Be The House · Single Shared Vault</p>
              </div>
            </div>
            <span className="mono inline-flex items-center gap-1 rounded-md bg-[var(--color-brand-500)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
              100% Solvency
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-2.5">
              <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)] block">
                Total LP Pool
              </span>
              <span className="mono mt-0.5 text-sm font-black text-white block">
                {poolLpDisplay}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-2.5">
              <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)] flex items-center justify-between">
                Current APY <TrendUp className="h-3 w-3 text-[var(--color-brand-500)]" />
              </span>
              <span className="mono mt-0.5 text-sm font-black text-[var(--color-brand-500)] block">
                +{pool?.estimatedApy ?? 18.4}% APY
              </span>
            </div>
          </div>

          {/* User's Current LP Position (If connected) */}
          {isAuthenticated && position && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--color-brand-500)]/20 bg-[var(--color-brand-500)]/10 px-3 py-2 text-xs">
              <span className="text-[var(--color-ink-2)] text-[11px]">My LP Stake:</span>
              <span className="mono font-bold text-white">
                {formatUsd(Number(position.currentValueUsdc || position.depositedUsdc))} USDC
              </span>
            </div>
          )}

          {/* Quick Deposit Form */}
          <form onSubmit={handleQuickDeposit} className="mt-3 space-y-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-ink-2)] flex items-center justify-between">
                <span>Deposit Amount</span>
                <span className="mono text-[10px] text-[var(--color-ink-3)]">USDC</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 50"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mono w-full rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-2 pl-3 pr-16 text-xs text-white placeholder-[var(--color-ink-4)] focus:border-[var(--color-brand-500)] focus:outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <UsdcIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                  <span className="mono text-[10px] font-bold text-[var(--color-ink-3)]">USDC</span>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5">
              {["10", "50", "100", "500"].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDepositAmount(amt)}
                  className="mono flex-1 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-1 text-[10px] font-bold text-[var(--color-ink-2)] hover:border-[var(--color-brand-500)] hover:text-white transition-colors"
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={txStep !== "idle"}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] py-2 text-xs font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <ZapIcon className="h-3.5 w-3.5" />
              {txStep === "approving"
                ? "Approving USDC..."
                : txStep === "signing"
                ? "Signing Transaction..."
                : txStep === "confirming"
                ? "Confirming Deposit..."
                : "Deposit to Pool"}
            </button>
          </form>

          {/* Footer Action Links */}
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line-1)] pt-2.5 text-[11px]">
            <Link
              href="/pools"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 font-semibold text-[var(--color-brand-500)] hover:underline"
            >
              Explore All Pools <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              href="/pools/my-positions"
              onClick={() => setOpen(false)}
              className="font-medium text-[var(--color-ink-3)] hover:text-white"
            >
              My Positions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
