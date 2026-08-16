"use client";
import { useEffect, useState, useCallback } from "react";
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
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ShieldIcon, ZapIcon, TrendUp, UsdcIcon, CopyIcon } from "@/components/icons/UIIcons";

type Step = "idle" | "approving" | "signing" | "confirming";

// Matches LiquidityPool.sol's `MIN_DEPOSIT = 10e6` — deposits below this
// revert on-chain with DepositTooSmall(). Checking client-side fails fast
// with a clear message instead of burning gas on a guaranteed revert.
const MIN_DEPOSIT_USDC = 10;

export default function PoolsPage() {
  const address = useWallet((s) => s.address);
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();
  const pushToast = useNotifications((s) => s.pushToast);

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<LPPositionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");

  const refresh = useCallback(async () => {
    const [poolRes, posRes] = await Promise.all([
      Liquidity.pool().catch(() => null),
      isAuthenticated ? Liquidity.myPositions().catch(() => null) : Promise.resolve(null),
    ]);
    if (poolRes) setPool(poolRes.pool);
    setPosition(posRes?.items[0] ?? null);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const liquidityPoolContract = (CONTRACT_ADDRESSES.liquidityPool || clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS) as `0x${string}`;
  const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as `0x${string}`;

  const handleDeposit = async () => {
    if (!isAuthenticated) { void signIn(); return; }
    if (!depositAmount || !address) return;
    if (parseFloat(depositAmount) < MIN_DEPOSIT_USDC) {
      pushToast({ kind: "warn", title: `Minimum deposit is ${MIN_DEPOSIT_USDC} USDC` });
      return;
    }

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
      pushToast({ kind: "success", title: "Deposit confirmed" });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Deposit failed", body: (e as Error).message });
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
      void receipt;
      pushToast({ kind: "info", title: "Withdrawal requested", body: "Unlocks in 48 hours" });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Request failed", body: (e as Error).message });
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
      pushToast({ kind: "success", title: "Withdrawal complete" });
      await refresh();
    } catch (e) {
      pushToast({ kind: "error", title: "Withdrawal failed", body: (e as Error).message });
    } finally {
      setStep("idle");
    }
  };

  const busy = step !== "idle";
  const stepLabel = step === "approving" ? "Approving USDC…" : step === "signing" ? "Confirm in the popup…" : step === "confirming" ? "Confirming…" : null;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="bg-mesh absolute inset-0" />
        <div className="relative grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <Badge variant="brand">Single shared pool · permissionless</Badge>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              Bank the house.
              <span className="block text-[var(--color-brand-500)]">Earn the margin.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Deposit USDC into SportyStake&apos;s single on-chain liquidity pool — it backs every
              sports betting market and parlay on the platform. Earn a proportional share of the
              house edge. Non-custodial, permissionless, one pool for the whole protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Metric label="Total value locked" value={loading ? "—" : formatUsd(Number(pool?.tvl ?? 0))} accent="var(--color-brand-500)" sub="Total pool liquidity capacity" />
          </div>
        </div>
      </div>

      {/* My position */}
      <div className="mt-5 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-5 py-3">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
            <p className="text-[13px] font-bold uppercase tracking-wider text-white">My position</p>
          </div>
          {address && (
            <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg-3)] px-2 py-1 text-[11px] text-[var(--color-ink-2)]">
              {address.slice(0, 6)}…{address.slice(-4)}
              <CopyIcon className="h-3 w-3" />
            </div>
          )}
        </div>
        {!isAuthenticated ? (
          <div className="p-5 text-center text-[13px] text-[var(--color-ink-3)]">
            <Button onClick={() => void signIn()}>Sign in with Google</Button>
          </div>
        ) : (
          <div className="grid items-center gap-4 p-5 md:grid-cols-3">
            <Position label="Deposited" value={`$${position ? parseFloat(position.depositedUsdc).toFixed(2) : "0.00"}`} sub="principal" />
            <Position
              label="Current value"
              value={`$${position ? parseFloat(position.currentValueUsdc).toFixed(2) : "0.00"}`}
              sub={position?.status === "WITHDRAW_REQUESTED" ? "withdrawal requested" : "live share price"}
              accent="var(--color-brand-500)"
            />
            <div className="flex items-center gap-2 md:justify-end">
              {position?.status === "WITHDRAW_REQUESTED" ? (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleExecuteWithdrawal()}>
                  {busy ? stepLabel : "Execute withdrawal"}
                </Button>
              ) : position && Number(position.onchainShares) > 0 ? (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleRequestWithdrawal()}>
                  {busy ? stepLabel : "Request withdrawal"}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Deposit */}
      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div className="border-b border-[var(--color-line-1)] px-5 py-3">
          <p className="text-[13px] font-bold uppercase tracking-wider text-white">Deposit USDC</p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">Amount</p>
              <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40">
                <UsdcIcon className="h-5 w-5" />
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={busy}
                  className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
                />
                <span className="text-[11px] font-bold text-[var(--color-ink-3)]">USDC</span>
              </div>
              <p className={`mt-1 text-[11px] ${depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) < MIN_DEPOSIT_USDC ? "font-semibold text-[var(--color-live)]" : "text-[var(--color-ink-4)]"}`}>
                Minimum {MIN_DEPOSIT_USDC} USDC
              </p>
            </div>
            <Button disabled={busy || !depositAmount || parseFloat(depositAmount) < MIN_DEPOSIT_USDC} onClick={() => void handleDeposit()}>
              {busy ? stepLabel : `Deposit ${depositAmount ? `${depositAmount} USDC` : ""}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Explainer */}
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Pillar Icon={ShieldIcon} title="Non-custodial" sub="Funds live inside the audited LiquidityPool contract. No platform balance sheet." />
        <Pillar Icon={TrendUp} title="Real yield" sub="Earnings denominated in margin from actual gameplay — not subsidized rewards." />
        <Pillar Icon={ZapIcon} title="48h exit timelock" sub="Request a withdrawal, then execute once the timelock clears. Protects against bank-run-style exits." />
      </div>
    </div>
  );
}

function Metric({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono mt-1 text-xl font-black" style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--color-ink-4)]">{sub}</p>}
    </div>
  );
}

function Position({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono text-2xl font-black text-white" style={accent ? { color: accent } : undefined}>{value}</p>
      <p className="text-[11px] text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}

function Pillar({
  Icon,
  title,
  sub,
}: {
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-brand-500)]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[14px] font-bold text-white">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}
