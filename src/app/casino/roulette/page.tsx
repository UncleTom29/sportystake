"use client";
import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationStore";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { placeCasinoBetOnchain, resolveCasinoBetWithRetry } from "@/lib/placeCasinoBet";
import PendingCasinoBetBanner from "@/components/casino/PendingCasinoBetBanner";

// Standard European wheel — physical pocket order (used to compute the
// spin landing angle) and the red/black colouring (used for the number grid).
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEGMENT_DEG = 360 / WHEEL_ORDER.length;

type OutsideBet = "red" | "black" | "even" | "odd" | "low" | "high" | "dozen1" | "dozen2" | "dozen3";

const OUTSIDE_BETS: { key: OutsideBet; label: string; betType: string; selection?: number; payout: string }[] = [
  { key: "red", label: "Red", betType: "red", payout: "2×" },
  { key: "black", label: "Black", betType: "black", payout: "2×" },
  { key: "even", label: "Even", betType: "even", payout: "2×" },
  { key: "odd", label: "Odd", betType: "odd", payout: "2×" },
  { key: "low", label: "1–18", betType: "low", payout: "2×" },
  { key: "high", label: "19–36", betType: "high", payout: "2×" },
  { key: "dozen1", label: "1st 12", betType: "dozen", selection: 1, payout: "3×" },
  { key: "dozen2", label: "2nd 12", betType: "dozen", selection: 2, payout: "3×" },
  { key: "dozen3", label: "3rd 12", betType: "dozen", selection: 3, payout: "3×" },
];

function numberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export default function RoulettePage() {
  const [betAmount, setBetAmount] = useState("10");
  const [selectedOutside, setSelectedOutside] = useState<OutsideBet | null>("red");
  const [selectedStraight, setSelectedStraight] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [result, setResult] = useState<{ number: number; win: boolean; payout: string } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const { pushToast } = useNotifications();
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();

  const activeBet = selectedStraight !== null
    ? { betType: "straight", selection: selectedStraight, label: `Straight up ${selectedStraight}`, payout: "36×" }
    : selectedOutside
    ? { ...OUTSIDE_BETS.find((b) => b.key === selectedOutside)!, label: OUTSIDE_BETS.find((b) => b.key === selectedOutside)!.label }
    : null;

  const wheelNumbers = useMemo(
    () => WHEEL_ORDER.map((n, i) => ({ n, angle: i * SEGMENT_DEG, color: numberColor(n) })),
    [],
  );

  const handlePendingResolved = useCallback((res: {
    outcome: { win: boolean; payout: string; detail: Record<string, unknown> };
  }) => {
    const landedNumber = res.outcome.detail.number as number;
    const idx = WHEEL_ORDER.indexOf(landedNumber);
    const targetDeg = 360 * 6 + (360 - idx * SEGMENT_DEG);
    setWheelRotation((prev) => prev - (prev % 360) + targetDeg);
    setResult({ number: landedNumber, win: res.outcome.win, payout: res.outcome.payout });
    setHistory((h) => [landedNumber, ...h].slice(0, 20));
  }, []);

  const spin = useCallback(async () => {
    if (!isAuthenticated) { void signIn(); return; }
    if (!activeBet) { pushToast({ kind: "warn", title: "Pick a bet first" }); return; }
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet amount" }); return; }

    setSpinning(true);
    setResult(null);

    const clientSeed = crypto.randomUUID();
    let txHash: string | null = null;
    try {
      const tx = await placeCasinoBetOnchain({ amountUsdc: betAmount, game: "roulette", clientSeed });
      txHash = tx.txHash;
    } catch (err) {
      pushToast({ kind: "warn", title: "On-chain deposit failed or cancelled", body: (err as Error).message });
      setSpinning(false);
      return;
    }

    try {
      const res = await resolveCasinoBetWithRetry({
        game: "roulette", txHash, clientSeed,
        betType: activeBet.betType, selection: activeBet.selection,
        amount: amt,
      });
      const landedNumber = res.outcome.detail.number as number;

      const idx = WHEEL_ORDER.indexOf(landedNumber);
      const targetDeg = 360 * 6 + (360 - idx * SEGMENT_DEG);
      setWheelRotation((prev) => prev - (prev % 360) + targetDeg);

      await new Promise((r) => setTimeout(r, 3200));

      setResult({ number: landedNumber, win: res.outcome.win, payout: res.outcome.payout });
      setHistory((h) => [landedNumber, ...h].slice(0, 20));
      if (res.outcome.win) {
        pushToast({ kind: "success", title: `${landedNumber} ${numberColor(landedNumber)} — You win!`, body: `+${(parseFloat(res.outcome.payout) - amt).toFixed(2)} USDC` });
      } else {
        pushToast({ kind: "error", title: `${landedNumber} ${numberColor(landedNumber)} — Better luck next time`, body: `-${amt.toFixed(2)} USDC` });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Settlement Delayed",
        body: `Deposit confirmed on-chain (Tx: ${txHash?.slice(0, 8)}…), but settlement timed out. Please click 'Resolve Settlement' in the banner.`,
      });
    } finally {
      setSpinning(false);
    }
  }, [betAmount, activeBet, isAuthenticated, signIn, pushToast]);

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
        <h1 className="text-2xl font-black tracking-tight text-white">Roulette</h1>
        <p className="text-[13px] text-[var(--color-ink-3)]">European wheel · single zero · pick a number or an outside bet.</p>
      </div>

      <PendingCasinoBetBanner game="roulette" onResolved={handlePendingResolved} />

      {/* History */}
      {history.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">History</span>
          {history.map((n, i) => {
            const c = numberColor(n);
            return (
              <span
                key={i}
                className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: c === "red" ? "#c0392b" : c === "black" ? "#1c1c1c" : "#0f6b34" }}
              >
                {n}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {/* Wheel */}
          <div className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[#0a1218]">
            <div className="relative h-64 w-64">
              <div
                className="absolute inset-0 rounded-full border-4 border-[#3a2a10] shadow-[0_0_40px_rgba(0,0,0,0.6)]"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: spinning ? "transform 3.2s cubic-bezier(0.15, 0.85, 0.25, 1)" : "none",
                  background: "conic-gradient(" + wheelNumbers.map((w, i) => {
                    const color = w.color === "red" ? "#c0392b" : w.color === "black" ? "#1c1c1c" : "#0f6b34";
                    const from = (i * SEGMENT_DEG).toFixed(2);
                    const to = ((i + 1) * SEGMENT_DEG).toFixed(2);
                    return `${color} ${from}deg ${to}deg`;
                  }).join(", ") + ")",
                }}
              >
                {wheelNumbers.map((w) => (
                  <span
                    key={w.n}
                    className="mono absolute left-1/2 top-1/2 origin-[0_0] text-[9px] font-bold text-white/80"
                    style={{ transform: `rotate(${w.angle}deg) translate(4px, -100px)` }}
                  >
                    {w.n}
                  </span>
                ))}
              </div>
              <div className="absolute inset-0 m-auto h-12 w-12 rounded-full border-2 border-[var(--color-line-2)] bg-[var(--color-bg-2)]" />
              {/* Pointer */}
              <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-[var(--color-warn)]" />
            </div>

            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
              {spinning ? (
                <p className="text-[13px] font-bold text-[var(--color-ink-3)]">Spinning…</p>
              ) : result ? (
                <div
                  className="mono flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white shadow-lg"
                  style={{ background: numberColor(result.number) === "red" ? "#c0392b" : numberColor(result.number) === "black" ? "#1c1c1c" : "#0f6b34" }}
                >
                  {result.number}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--color-ink-3)]">Place a bet to spin</p>
              )}
            </div>
          </div>

          {/* Number grid */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Straight up (36×)</p>
            <div className="grid grid-cols-10 gap-1">
              <button
                onClick={() => { setSelectedStraight(0); setSelectedOutside(null); }}
                disabled={spinning}
                className={`mono col-span-1 row-span-3 flex items-center justify-center rounded-md text-[12px] font-bold text-white transition-all ${selectedStraight === 0 ? "ring-2 ring-[var(--color-brand-500)]" : ""}`}
                style={{ background: "#0f6b34" }}
              >
                0
              </button>
              {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                const c = numberColor(n);
                return (
                  <button
                    key={n}
                    onClick={() => { setSelectedStraight(n); setSelectedOutside(null); }}
                    disabled={spinning}
                    className={`mono flex h-8 items-center justify-center rounded-md text-[11px] font-bold text-white transition-all ${selectedStraight === n ? "ring-2 ring-[var(--color-brand-500)]" : ""}`}
                    style={{ background: c === "red" ? "#c0392b" : "#1c1c1c" }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outside bets */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Outside bets</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {OUTSIDE_BETS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => { setSelectedOutside(b.key); setSelectedStraight(null); }}
                  disabled={spinning}
                  className={`flex h-11 flex-col items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                    selectedOutside === b.key
                      ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                      : "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"
                  }`}
                >
                  {b.label}
                  <span className="mono text-[9px] opacity-70">{b.payout}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
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
                disabled={spinning}
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
              />
            </div>
            <div className="mb-3 grid grid-cols-4 gap-1">
              {[5, 10, 50, 100].map((v) => (
                <button key={v} onClick={() => setBetAmount(String(v))} disabled={spinning}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
                  {v}
                </button>
              ))}
            </div>

            <div className="mb-4 space-y-2 rounded-md bg-[var(--color-bg-1)] p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Your bet</span>
                <span className="font-bold text-white">{activeBet?.label ?? "None selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Payout</span>
                <span className="mono font-bold text-[var(--color-brand-500)]">{activeBet?.payout ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Verification</span>
                <span className="mono font-bold text-[var(--color-brand-500)]">Provably Fair</span>
              </div>
            </div>

            <button
              onClick={() => void spin()}
              disabled={spinning || !activeBet}
              className="w-full rounded-md bg-[var(--color-brand-500)] py-3 text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
          </div>

          {result && !spinning && (
            <div className={`rounded-xl border p-4 text-center ${result.win ? "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10" : "border-[var(--color-line-1)] bg-[var(--color-bg-2)]"}`}>
              <p className="text-[13px] font-bold" style={{ color: result.win ? "var(--color-brand-500)" : "var(--color-live)" }}>
                {result.win ? `Won $${result.payout}` : "No win this round"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
