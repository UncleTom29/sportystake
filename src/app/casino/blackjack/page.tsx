"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationStore";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { placeCasinoBetOnchain, resolveCasinoBetWithRetry } from "@/lib/placeCasinoBet";
import PendingCasinoBetBanner from "@/components/casino/PendingCasinoBetBanner";

interface HandResult {
  player: number;
  dealer: number;
  playerBust: boolean;
  dealerBust: boolean;
  win: boolean;
  push: boolean;
  payout: string;
}

/**
 * The on-chain resolver plays the whole hand server-side in one shot
 * (player auto-hits under 17, dealer draws to 17) rather than exposing
 * hit/stand choices — there's no per-card rank data to deal with either,
 * just the two final totals. This UI reflects that honestly: one Deal
 * button, cards flip to reveal totals, no fake interactivity the backend
 * doesn't actually support.
 */
export default function BlackjackPage() {
  const [betAmount, setBetAmount] = useState("10");
  const [dealing, setDealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<HandResult | null>(null);
  const { pushToast } = useNotifications();
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();

  const handlePendingResolved = useCallback((res: {
    outcome: { win: boolean; payout: string; multiplier: number; detail: Record<string, unknown> };
  }) => {
    const d = res.outcome.detail as { player: number; dealer: number; playerBust: boolean; dealerBust: boolean };
    const push = res.outcome.multiplier === 1;
    setResult({ ...d, win: res.outcome.win, push, payout: res.outcome.payout });
    setRevealed(true);
  }, []);

  const deal = useCallback(async () => {
    if (!isAuthenticated) { void signIn(); return; }
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet amount" }); return; }

    setDealing(true);
    setRevealed(false);
    setResult(null);

    const clientSeed = crypto.randomUUID();
    let txHash: string | null = null;
    try {
      const tx = await placeCasinoBetOnchain({ amountUsdc: betAmount, game: "blackjack", clientSeed });
      txHash = tx.txHash;
    } catch (err) {
      pushToast({ kind: "warn", title: "On-chain deposit failed or cancelled", body: (err as Error).message });
      setDealing(false);
      return;
    }

    try {
      const res = await resolveCasinoBetWithRetry({ game: "blackjack", txHash, clientSeed, amount: amt });
      const d = res.outcome.detail as { player: number; dealer: number; playerBust: boolean; dealerBust: boolean };

      await new Promise((r) => setTimeout(r, 900));

      const payoutNum = parseFloat(res.outcome.payout);
      const push = res.outcome.multiplier === 1;
      setResult({ ...d, win: res.outcome.win, push, payout: res.outcome.payout });
      setRevealed(true);

      if (res.outcome.win) {
        pushToast({ kind: "success", title: `${d.player} beats dealer's ${d.dealer}`, body: `+${(payoutNum - amt).toFixed(2)} USDC` });
      } else if (push) {
        pushToast({ kind: "info", title: "Push", body: "Stake returned" });
      } else {
        pushToast({ kind: "error", title: d.playerBust ? "Bust!" : `Dealer wins ${d.dealer}–${d.player}`, body: `-${amt.toFixed(2)} USDC` });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Settlement Delayed",
        body: `Deposit confirmed on-chain (Tx: ${txHash?.slice(0, 8)}…), but settlement timed out. Please click 'Resolve Settlement' in the banner.`,
      });
    } finally {
      setDealing(false);
    }
  }, [betAmount, isAuthenticated, signIn, pushToast]);

  return (
    <div className="mx-auto max-w-[1200px] px-3 py-4 md:px-5">
      <div className="mb-4">
        <div className="mb-2">
          <Link
            href="/casino"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-bg-3)] hover:border-[var(--color-line-2)]"
          >
            ← Back to Casino
          </Link>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Blackjack</h1>
        <p className="text-[13px] text-[var(--color-ink-3)]">Dealer draws to 17. Beat their total without busting past 21.</p>
      </div>

      <PendingCasinoBetBanner game="blackjack" onResolved={handlePendingResolved} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="relative flex min-h-[340px] flex-col items-center justify-center gap-8 overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-gradient-to-b from-[#0d2818] to-[#0a1218] p-6">
            {/* Dealer */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Dealer</p>
              <div className="flex gap-2">
                <PlayingCardBack flipped={revealed} />
                <PlayingCardBack flipped={revealed} delay={100} />
              </div>
              {revealed && result && (
                <p className="mono text-2xl font-black" style={{ color: result.dealerBust ? "var(--color-live)" : "white" }}>
                  {result.dealer}{result.dealerBust ? " (bust)" : ""}
                </p>
              )}
            </div>

            {/* Result banner */}
            {revealed && result && (
              <div
                className="mono rounded-full px-4 py-1.5 text-[13px] font-black uppercase tracking-wider"
                style={{
                  background: result.win ? "rgba(0,231,1,0.15)" : result.push ? "rgba(255,176,32,0.15)" : "rgba(255,45,45,0.15)",
                  color: result.win ? "var(--color-brand-500)" : result.push ? "var(--color-warn)" : "var(--color-live)",
                }}
              >
                {result.win ? "You win" : result.push ? "Push" : "Dealer wins"}
              </div>
            )}
            {dealing && !revealed && <p className="text-[13px] text-[var(--color-ink-3)]">Dealing…</p>}
            {!dealing && !revealed && <p className="text-[13px] text-[var(--color-ink-3)]">Place a bet to deal</p>}

            {/* Player */}
            <div className="flex flex-col items-center gap-2">
              {revealed && result && (
                <p className="mono text-2xl font-black" style={{ color: result.playerBust ? "var(--color-live)" : "white" }}>
                  {result.player}{result.playerBust ? " (bust)" : ""}
                </p>
              )}
              <div className="flex gap-2">
                <PlayingCardBack flipped={revealed} delay={200} accent />
                <PlayingCardBack flipped={revealed} delay={300} accent />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">You</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Place bet</p>

            <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Bet amount (USDC)</label>
            <div className="mb-2 flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40">
              <span className="mono text-[var(--color-ink-3)]">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                disabled={dealing}
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
              />
            </div>
            <div className="mb-4 grid grid-cols-4 gap-1">
              {[5, 10, 50, 100].map((v) => (
                <button key={v} onClick={() => setBetAmount(String(v))} disabled={dealing}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
                  {v}
                </button>
              ))}
            </div>

            <div className="mb-4 space-y-2 rounded-md bg-[var(--color-bg-1)] p-3 text-[13px]">
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Payout on win</span><span className="mono font-bold text-[var(--color-brand-500)]">2×</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Push</span><span className="mono font-bold text-white">Stake returned</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Verification</span><span className="mono font-bold text-[var(--color-brand-500)]">Provably Fair</span></div>
            </div>

            <button
              onClick={() => void deal()}
              disabled={dealing}
              className="w-full rounded-md bg-[var(--color-brand-500)] py-3 text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dealing ? "Dealing…" : "Deal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayingCardBack({ flipped, delay = 0, accent = false }: { flipped: boolean; delay?: number; accent?: boolean }) {
  return (
    <div
      className="relative h-20 w-14 rounded-md border-2 transition-transform duration-500"
      style={{
        borderColor: "var(--color-line-2)",
        background: flipped
          ? `linear-gradient(160deg, ${accent ? "var(--color-brand-500)" : "#a78bfa"}22 0%, var(--color-bg-2) 100%)`
          : "repeating-linear-gradient(45deg, var(--color-bg-3), var(--color-bg-3) 4px, var(--color-bg-4) 4px, var(--color-bg-4) 8px)",
        transitionDelay: `${delay}ms`,
        transform: flipped ? "rotateY(0deg) scale(1.02)" : "rotateY(180deg)",
      }}
    />
  );
}
