"use client";

import { useState } from "react";
import { useWallet } from "@/lib/walletStore";
import { useNotifications } from "@/lib/notificationStore";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletButton() {
  const status = useWallet((s) => s.status);
  const user = useWallet((s) => s.user);
  const address = useWallet((s) => s.address);
  const balance = useWallet((s) => s.balanceUsdc);
  const hasInjected = useWallet((s) => s.hasInjected);
  const connect = useWallet((s) => s.connect);
  const connectDev = useWallet((s) => s.connectDev);
  const disconnect = useWallet((s) => s.disconnect);
  const error = useWallet((s) => s.error);
  const pushToast = useNotifications((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === "connected" && user && address) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-md border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 px-2.5 py-1.5 sm:flex">
            <span className="mono text-[11px] font-black text-[var(--color-brand-500)]">${balance}</span>
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
              style={{ background: `linear-gradient(135deg, var(--color-brand-500), #2dc4ff)` }}
              aria-hidden
            />
            <span className="mono hidden sm:inline">{user.username ?? shortAddr(address)}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
        </div>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-1.5 w-[220px] overflow-hidden rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] shadow-xl"
          >
            <div className="border-b border-[var(--color-line-1)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Wallet</p>
              <p className="mono mt-0.5 text-[12px] text-white">{shortAddr(address)}</p>
              <p className="mono mt-2 text-[16px] font-black text-[var(--color-brand-500)]">${balance} <span className="text-[10px] font-bold text-[var(--color-brand-500)]/70">USDC</span></p>
            </div>
            <a href="/account" className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">Account</a>
            <a href="/account/bets" className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">My bets</a>
            <a href="/pools/my-positions" className="block px-3 py-2 text-[12px] hover:bg-[var(--color-bg-3)]">My LP positions</a>
            {user.roles.includes("ADMIN") && (
              <a href="/admin" className="block px-3 py-2 text-[12px] text-[var(--color-brand-500)] hover:bg-[var(--color-bg-3)]">Admin</a>
            )}
            <button
              onClick={async () => { setMenuOpen(false); await disconnect(); pushToast({ kind: "info", title: "Signed out" }); }}
              className="block w-full border-t border-[var(--color-line-1)] px-3 py-2 text-left text-[12px] text-[var(--color-live)] hover:bg-[var(--color-bg-3)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={status === "connecting"}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-[400px] max-w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Sign in</p>
                <h3 className="text-lg font-black tracking-tight text-white">Connect a wallet</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-[var(--color-ink-3)] hover:text-white" aria-label="Close">×</button>
            </div>
            <p className="mb-4 text-[12px] text-[var(--color-ink-2)]">
              SportyStake is non-custodial. Sign in with SIWE on the Arc network. USDC is the only supported asset.
            </p>
            <div className="space-y-2">
              <ConnectorRow
                name="MetaMask / browser wallet"
                detail={hasInjected ? "Detected" : "Not installed"}
                disabled={status === "connecting"}
                onClick={async () => { await connect(); setOpen(false); }}
                accent="#f6851b"
              />
              <ConnectorRow
                name="WalletConnect"
                detail="Scan with mobile wallet (coming soon)"
                disabled
                onClick={() => undefined}
                accent="#2D82FF"
              />
              <ConnectorRow
                name="Coinbase Wallet"
                detail="Coming soon"
                disabled
                onClick={() => undefined}
                accent="#1652f0"
              />
              <div className="border-t border-[var(--color-line-1)] pt-2" />
              <ConnectorRow
                name="Dev sign-in"
                detail="No wallet required — uses an ephemeral test address"
                disabled={status === "connecting"}
                onClick={async () => { await connectDev(); setOpen(false); pushToast({ kind: "success", title: "Signed in", body: "Dev mode session active" }); }}
                accent="var(--color-brand-500)"
              />
            </div>
            {error && (
              <p className="mt-3 rounded-md border border-[var(--color-live)]/40 bg-[var(--color-live)]/10 px-3 py-2 text-[11px] text-[var(--color-live)]">
                {error}
              </p>
            )}
            <p className="mt-3 text-[10px] text-[var(--color-ink-3)]">
              By signing in you agree to our <a href="/terms" className="underline hover:text-white">Terms</a> and confirm you are not in a restricted jurisdiction.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ConnectorRow({
  name, detail, disabled, onClick, accent,
}: { name: string; detail: string; disabled: boolean; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3 text-left transition-colors hover:bg-[var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="h-8 w-8 shrink-0 rounded-md" style={{ background: accent }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-white">{name}</p>
        <p className="text-[10px] text-[var(--color-ink-3)]">{detail}</p>
      </div>
      <span className="text-[var(--color-ink-3)]" aria-hidden>→</span>
    </button>
  );
}
