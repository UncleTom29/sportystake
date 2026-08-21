"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { useUsdcBalance, formatUsdc } from "@/lib/useWalletBalance";
import { useNotifications } from "@/lib/notificationStore";
import {
  ChevronDown,
  CopyIcon,
  ZapIcon,
  ShieldIcon,
  UsdcIcon,
  ArrowUpRight,
  ChevronLeft,
} from "@/components/icons/UIIcons";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function UserBalanceDropdown() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"overview" | "deposit" | "withdraw">("overview");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const authStatus = useWallet((s) => s.authStatus);
  const user = useWallet((s) => s.user);
  const address = useWallet((s) => s.address);
  const { signIn, isSigningIn } = usePrivyLogin();
  const pushToast = useNotifications((s) => s.pushToast);

  const { balance } = useUsdcBalance({ address: address ?? undefined });
  const balanceLabel = formatUsdc(balance);
  const displayAddress = address ?? "";

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
        setView("overview");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setView("overview");
      }
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

  const copyAddress = () => {
    if (!displayAddress) return;
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    pushToast({
      kind: "success",
      title: "Address Copied! 📋",
      body: displayAddress,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // State 1: Not signed in → 1-click Deposit / Connect trigger
  if (authStatus !== "authenticated" || !user || !address) {
    return (
      <button
        onClick={async () => {
          try {
            await signIn();
          } catch (e) {
            pushToast({ kind: "error", title: "Sign-in failed", body: (e as Error).message });
          }
        }}
        disabled={isSigningIn}
        aria-label="Deposit USDC"
        className="flex h-9 items-center gap-1 rounded-lg border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 px-2 sm:px-2.5 py-1 text-xs font-bold text-white hover:border-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/20 transition-all active:scale-95 shadow-sm"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)]">
          <UsdcIcon className="h-3.5 w-3.5" />
        </div>
        <span className="mono text-[12px] font-black text-white">$0.00</span>
        <span className="rounded bg-[var(--color-brand-500)] px-1.5 py-0.5 text-[10px] font-black text-black uppercase ml-0.5">
          {isSigningIn ? "…" : "Deposit"}
        </span>
      </button>
    );
  }

  // State 2: Signed in — User Balance Pill + Popover Dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: User Balance Pill */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setView("overview");
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User Balance and Wallet Dropdown"
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all shadow-sm ${
          open
            ? "border-[var(--color-brand-500)] bg-[var(--color-bg-3)] text-white ring-2 ring-[var(--color-brand-500)]/20"
            : "border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] text-white hover:border-[var(--color-brand-500)] hover:bg-[var(--color-bg-3)]"
        }`}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]">
          <UsdcIcon className="h-3.5 w-3.5" />
        </div>
        <span className="mono text-[12px] font-black text-white">
          ${balanceLabel}
        </span>
        <span className="mono text-[10px] font-bold text-[var(--color-brand-500)]/80 hidden sm:inline">
          USDC
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--color-ink-3)] transition-transform duration-200 ${
            open ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Card */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {view === "overview" && (
            <div className="space-y-4">
              {/* Wallet Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Arc Network Wallet
                  </p>
                  <p className="mono text-[12px] font-bold text-white mt-0.5">
                    {shortAddr(displayAddress)}
                  </p>
                </div>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 rounded-md bg-[var(--color-bg-1)] px-2 py-1 text-[10px] font-semibold text-[var(--color-ink-2)] hover:text-white border border-[var(--color-line-1)]"
                >
                  <CopyIcon className="h-3 w-3" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Balance Box */}
              <div className="rounded-xl bg-[var(--color-bg-1)] p-3.5 border border-[var(--color-line-1)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] block">
                  Available USDC Balance
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="mono text-2xl font-black text-white">
                    ${balanceLabel}
                  </span>
                  <span className="mono text-xs font-bold text-[var(--color-brand-500)]">
                    USDC
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
                  Arc EVM · Sub-second settlement
                </p>
              </div>

              {/* Action Buttons: Deposit & Withdraw */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setView("deposit")}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] py-2.5 text-xs font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all shadow-md active:scale-95"
                >
                  <ZapIcon className="h-3.5 w-3.5" /> Deposit
                </button>
                <button
                  onClick={() => setView("withdraw")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] py-2.5 text-xs font-bold text-white hover:bg-[var(--color-bg-3)] transition-all active:scale-95"
                >
                  Withdraw
                </button>
              </div>

              {/* Quick Links Footer */}
              <div className="flex items-center justify-between border-t border-[var(--color-line-1)] pt-3 text-[11px]">
                <Link
                  href="/account/wallet"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1 font-semibold text-[var(--color-brand-500)] hover:underline"
                >
                  Full Wallet Settings <ArrowUpRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/account/bets"
                  onClick={() => setOpen(false)}
                  className="font-medium text-[var(--color-ink-3)] hover:text-white"
                >
                  My Bets
                </Link>
              </div>
            </div>
          )}

          {view === "deposit" && (
            <div className="space-y-3.5">
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-2.5">
                <button
                  onClick={() => setView("overview")}
                  className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-2)] hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                <span className="text-xs font-bold text-white">Deposit USDC</span>
                <div className="w-10" />
              </div>

              <p className="text-[11px] text-[var(--color-ink-2)] leading-relaxed">
                Send USDC on the <strong>Arc Network</strong> directly to your personal address below. Funds credit automatically after 1 block confirmation.
              </p>

              {/* QR / Address Container */}
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] text-[var(--color-ink-3)]">
                    <svg viewBox="0 0 100 100" className="h-16 w-16 opacity-50 text-[var(--color-brand-500)]">
                      <rect x={10} y={10} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                      <rect x={55} y={10} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                      <rect x={10} y={55} width={35} height={35} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
                      <rect x={20} y={20} width={15} height={15} rx={2} fill="currentColor" />
                      <rect x={65} y={20} width={15} height={15} rx={2} fill="currentColor" />
                      <rect x={20} y={65} width={15} height={15} rx={2} fill="currentColor" />
                      <rect x={55} y={55} width={10} height={10} fill="currentColor" />
                      <rect x={70} y={55} width={10} height={10} fill="currentColor" />
                      <rect x={55} y={70} width={10} height={10} fill="currentColor" />
                      <rect x={80} y={80} width={10} height={10} fill="currentColor" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-2">
                  <span className="mono flex-1 truncate text-[11px] font-bold text-white text-left">
                    {displayAddress}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="shrink-0 rounded bg-[var(--color-brand-500)] px-2 py-1 text-[10px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-3)]">
                <span className="flex items-center gap-1">
                  <ShieldIcon className="h-3 w-3 text-emerald-400" /> Only Arc Network USDC
                </span>
                <Link
                  href="/account/wallet"
                  onClick={() => setOpen(false)}
                  className="font-bold text-[var(--color-brand-500)] hover:underline"
                >
                  Wallet Hub →
                </Link>
              </div>
            </div>
          )}

          {view === "withdraw" && (
            <div className="space-y-3">
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-2.5">
                <button
                  onClick={() => setView("overview")}
                  className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-2)] hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                <span className="text-xs font-bold text-white">Withdraw USDC</span>
                <div className="w-10" />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] block mb-1">
                  Amount (USDC)
                </label>
                <div className="flex h-10 items-center rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]">
                  <span className="mono text-[var(--color-ink-3)] text-xs">$</span>
                  <input
                    type="number"
                    step="any"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="mono ml-2 w-full bg-transparent text-xs font-bold text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balanceLabel.replace(/,/g, ""))}
                    className="text-[10px] font-black text-[var(--color-brand-500)] uppercase hover:underline"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] block mb-1">
                  Recipient Address (Arc Network)
                </label>
                <input
                  type="text"
                  value={withdrawTo}
                  onChange={(e) => setWithdrawTo(e.target.value)}
                  placeholder="0x..."
                  className="mono h-10 w-full rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 text-xs text-white outline-none focus:border-[var(--color-brand-500)] placeholder:text-[var(--color-ink-4)]"
                />
              </div>

              <Link
                href="/account/wallet"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] py-2 text-xs font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-all shadow-md"
              >
                Go to Wallet to Confirm →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
