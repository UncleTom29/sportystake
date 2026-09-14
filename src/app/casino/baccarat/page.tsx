"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationStore";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { placeCasinoBetOnchain, resolveCasinoBetWithRetry } from "@/lib/placeCasinoBet";
import PendingCasinoBetBanner from "@/components/casino/PendingCasinoBetBanner";

type Bet = "player" | "banker" | "tie";

const BETS: { key: Bet; label: string; payout: string }[] = [
  { key: "player", label: "Player", payout: "2×" },
  { key: "banker", label: "Banker", payout: "1.95×" },
  { key: "tie", label: "Tie", payout: "9×" },
];

interface HandResult {
  player: number;
  banker: number;
  winner: Bet;
  win: boolean;
  payout: string;
}

export default function BaccaratPage() {
  const [betAmount, setBetAmount] = useState("10");
  const [selectedBet, setSelectedBet] = useState<Bet>("player");
  const [dealing, setDealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<HandResult | null>(null);
  const { pushToast } = useNotifications();
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();

  const handlePendingResolved = useCallback((res: {
    outcome: { win: boolean; payout: string; multiplier: number; detail: Record<string, unknown> };
  }) => {
    const d = res.outcome.detail as { player: number; banker: number; winner: Bet };
    setResult({ ...d, win: res.outcome.win, payout: res.outcome.payout });
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
      const tx = await placeCasinoBetOnchain({ amountUsdc: betAmount, game: "baccarat", clientSeed });
      txHash = tx.txHash;
    } catch (err) {
      pushToast({ kind: "warn", title: "On-chain deposit failed or cancelled", body: (err as Error).message });
      setDealing(false);
      return;
    }

    try {
      const res = await resolveCasinoBetWithRetry({
        game: "baccarat", txHash, clientSeed, bet: selectedBet, amount: amt,
      });
      const d = res.outcome.detail as { player: number; banker: number; winner: Bet };

      await new Promise((r) => setTimeout(r, 900));

      setResult({ ...d, win: res.outcome.win, payout: res.outcome.payout });
      setRevealed(true);

      if (res.outcome.win) {
        pushToast({ kind: "success", title: `${d.winner} wins — ${d.player} vs ${d.banker}`, body: `+${(parseFloat(res.outcome.payout) - amt).toFixed(2)} USDC` });
      } else {
        pushToast({ kind: "error", title: `${d.winner} wins — ${d.player} vs ${d.banker}`, body: `-${amt.toFixed(2)} USDC` });
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
  }, [betAmount, selectedBet, isAuthenticated, signIn, pushToast]);

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
        <h1 className="text-2xl font-black tracking-tight text-white">Baccarat</h1>
        <p className="text-[13px] text-[var(--color-ink-3)]">Bet on Player, Banker, or a Tie. Closest hand to 9 wins.</p>
      </div>

      <PendingCasinoBetBanner game="baccarat" onResolved={handlePendingResolved} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
            <div className="flex w-full max-w-md items-center justify-between gap-4">
              <HandDisplay label="Player" total={revealed ? result?.player ?? null : null} revealed={revealed} won={revealed && result?.winner === "player"} />
              <div className="mono text-lg font-black text-[var(--color-ink-3)]">VS</div>
              <HandDisplay label="Banker" total={revealed ? result?.banker ?? null : null} revealed={revealed} won={revealed && result?.winner === "banker"} />
            </div>

            {dealing && !revealed && (
              <p className="absolute bottom-6 text-[13px] text-[var(--color-ink-3)]">Dealing…</p>
            )}
            {revealed && result && (
              <div
                className="mono absolute bottom-6 rounded-full px-4 py-1.5 text-[13px] font-black uppercase tracking-wider"
                style={{
                  background: result.win ? "rgba(0,231,1,0.15)" : "rgba(255,45,45,0.15)",
                  color: result.win ? "var(--color-brand-500)" : "var(--color-live)",
                }}
              >
                {result.winner} wins{result.win ? " · you won" : ""}
              </div>
            )}
            {!dealing && !revealed && (
              <p className="absolute bottom-6 text-[13px] text-[var(--color-ink-3)]">Pick a bet and deal</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Place bet</p>

            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {BETS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setSelectedBet(b.key)}
                  disabled={dealing}
                  className={`flex h-14 flex-col items-center justify-center rounded-md text-[12px] font-bold transition-colors ${
                    selectedBet === b.key
                      ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                      : "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"
                  }`}
                >
                  {b.label}
                  <span className="mono text-[10px] opacity-70">{b.payout}</span>
                </button>
              ))}
            </div>

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

            <div className="mb-4 flex items-center justify-between rounded-md bg-[var(--color-bg-1)] p-3 text-[13px]">
              <span className="text-[var(--color-ink-3)]">Verification</span>
              <span className="mono font-bold text-[var(--color-brand-500)]">Provably Fair</span>
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

function HandDisplay({ label, total, revealed, won }: { label: string; total: number | null; revealed: boolean; won: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <div className="flex gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-20 w-14 rounded-md border-2 transition-all duration-500"
            style={{
              borderColor: won ? "var(--color-brand-500)" : "var(--color-line-2)",
              background: revealed
                ? "var(--color-bg-3)"
                : "repeating-linear-gradient(45deg, var(--color-bg-3), var(--color-bg-3) 4px, var(--color-bg-4) 4px, var(--color-bg-4) 8px)",
              transitionDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
      <p className="mono text-2xl font-black" style={{ color: won ? "var(--color-brand-500)" : "white" }}>
        {total ?? "—"}
      </p>
    </div>
  );
}
