"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { useUsdcBalance, formatUsdc } from "@/lib/useWalletBalance";
import { useNotifications } from "@/lib/notificationStore";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Two rendering states:
 *   1. Not signed in → "Sign In" button (Privy auth).
 *   2. Signed in → menu with balance + links.
 */
export default function WalletButton() {
  const authStatus = useWallet((s) => s.authStatus);
  const user = useWallet((s) => s.user);
  const address = useWallet((s) => s.address);
  const { signIn, signOut, isSigningIn, error } = usePrivyLogin();
  const pushToast = useNotifications((s) => s.pushToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const { balance } = useUsdcBalance({ address: address ?? undefined });
  const balanceLabel = formatUsdc(balance);

  // State 1: not signed in
  if (authStatus !== "authenticated" || !user || !address) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={async () => {
            try {
              await signIn();
            } catch (e) {
              pushToast({ kind: "error", title: "Sign-in failed", body: (e as Error).message });
            }
          }}
          disabled={isSigningIn}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:opacity-60"
        >
          {isSigningIn ? "Signing in…" : "Sign In"}
        </button>
        {error && (
          <span className="hidden text-[10px] text-[var(--color-live)] md:inline">{error}</span>
        )}
      </div>
    );
  }

  // State 2: signed in
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <div className="hidden items-center gap-1.5 rounded-md border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 px-2.5 py-1.5 sm:flex">
          <span className="mono text-[11px] font-black text-[var(--color-brand-500)]">${balanceLabel}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-500)]/70">USDC</span>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span
            className="h-5 w-5 shrink-0 rounded-full"
            style={{ background: "linear-gradient(135deg, var(--color-brand-500), #2dc4ff)" }}
            aria-hidden
          />
          <span className="mono hidden sm:inline">{user.username ?? shortAddr(address)}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-[240px] overflow-hidden rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] shadow-xl"
        >
          <div className="border-b border-[var(--color-line-1)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Wallet</p>
            <p className="mono mt-0.5 text-[12px] text-white">{shortAddr(address)}</p>
            <p className="mono mt-2 text-[16px] font-black text-[var(--color-brand-500)]">
              ${balanceLabel}{" "}
              <span className="text-[10px] font-bold text-[var(--color-brand-500)]/70">USDC</span>
            </p>
          </div>
          <Link href="/account" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">
            Account
          </Link>
          <Link href="/account/bets" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">
            My bets
          </Link>
          <Link href="/pools/my-positions" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">
            My LP positions
          </Link>
          {Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "OPERATOR")) && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-[12px] font-bold text-[var(--color-brand-500)] hover:bg-[var(--color-bg-3)]"
            >
              Admin Portal 🛡️
            </Link>
          )}
          <button
            onClick={async () => {
              setMenuOpen(false);
              await signOut();
              pushToast({ kind: "info", title: "Signed out" });
            }}
            className="block w-full border-t border-[var(--color-line-1)] px-3 py-2 text-left text-[12px] text-[var(--color-live)] hover:bg-[var(--color-bg-3)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
