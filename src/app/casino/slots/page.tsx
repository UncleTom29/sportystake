"use client";
import { useState, useCallback, useRef } from "react";
import { useNotifications } from "@/lib/notificationStore";

const SYMBOLS = ["🍒", "🍋", "⭐", "💎", "🔔", "7️⃣", "🃏"] as const;
type Symbol = typeof SYMBOLS[number];

const PAYOUTS: Record<Symbol, number> = {
  "🍒": 2, "🍋": 3, "⭐": 5, "💎": 10, "🔔": 8, "7️⃣": 25, "🃏": 50,
};

const WEIGHTS = [30, 25, 20, 8, 10, 5, 2]; // relative frequency

function weightedRandom(): Symbol {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function spin3(): [Symbol, Symbol, Symbol] {
  return [weightedRandom(), weightedRandom(), weightedRandom()];
}

type SpinResult = { reels: [Symbol, Symbol, Symbol]; payout: number; win: boolean };

function evaluate(reels: [Symbol, Symbol, Symbol], bet: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    // Jackpot - three in a row
    const base = PAYOUTS[a];
    return base * bet * 3;
  }
  if (a === b || b === c) {
    // Two in a row
    const sym = a === b ? a : b;
    return Math.floor(PAYOUTS[sym] * bet * 0.5);
  }
  // Wild (🃏) substitutes any
  if (a === "🃏" || c === "🃏") {
    const sym = a === "🃏" ? c : a;
    return Math.floor(PAYOUTS[sym] * bet * 0.8);
  }
  return 0;
}

export default function SlotsPage() {
  const [reels, setReels] = useState<[Symbol, Symbol, Symbol]>(["🍒", "🍋", "⭐"]);
  const [spinning, setSpinning] = useState(false);
  const [bet, setBet] = useState("10");
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [flashWin, setFlashWin] = useState(false);
  const autoRef = useRef(false);
  const { pushToast } = useNotifications();

  const doSpin = useCallback(async () => {
    const amount = parseFloat(bet);
    if (!amount || amount <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet" }); return; }
    setSpinning(true);
    setFlashWin(false);

    // Animate reels sequentially
    const final = spin3();
    const animations = [0, 1, 2].map((i) => new Promise<void>((res) => setTimeout(res, 300 + i * 200)));
    await animations[0];
    setReels((prev) => [final[0], prev[1], prev[2]]);
    await animations[1];
    setReels((prev) => [prev[0], final[1], prev[2]]);
    await animations[2];
    setReels(final);

    const payout = evaluate(final, amount);
    const net = payout - amount;
    const won = payout > 0;

    setHistory((h) => [{ reels: final, payout: net, win: won }, ...h].slice(0, 20));
    setSpinning(false);

    if (won) {
      setFlashWin(true);
      setTimeout(() => setFlashWin(false), 2000);
      pushToast({ kind: "success", title: `Win! +${payout.toFixed(2)} USDC`, body: `${final.join(" ")}` });
    }

    if (autoRef.current) {
      setTimeout(() => { if (autoRef.current) doSpin(); }, 800);
    }
  }, [bet, pushToast]);

  const toggleAuto = () => {
    const next = !autoSpin;
    setAutoSpin(next);
    autoRef.current = next;
    if (next) doSpin();
  };

  const isJackpot = reels[0] === reels[1] && reels[1] === reels[2];
  const stats = {
    wins: history.filter((h) => h.win).length,
    total: history.length,
    netPnl: history.reduce((s, h) => s + h.payout, 0),
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Slots</h1>
        <p className="text-[13px] text-[var(--color-ink-3)]">5 reels · 20 paylines · provably fair RNG</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Slot machine */}
        <div className="space-y-4">
          {/* Machine display */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-8 transition-all ${
              flashWin
                ? "border-[var(--color-warn)]/60 bg-[var(--color-warn)]/5"
                : isJackpot && !spinning
                ? "border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/5"
                : "border-[var(--color-line-1)] bg-[var(--color-bg-2)]"
            }`}
          >
            {isJackpot && !spinning && (
              <div className="absolute inset-x-0 top-0 flex justify-center">
                <div className="mono rounded-b-lg bg-[var(--color-brand-500)] px-4 py-1 text-[12px] font-black uppercase text-[var(--color-bg-0)]">
                  JACKPOT!
                </div>
              </div>
            )}

            {/* Reels */}
            <div className="flex items-center justify-center gap-3">
              {reels.map((sym, i) => (
                <div
                  key={i}
                  className={`flex h-28 w-28 items-center justify-center rounded-xl border-2 text-5xl transition-all ${
                    spinning ? "animate-bounce border-[var(--color-line-2)] bg-[var(--color-bg-3)]" : "border-[var(--color-line-1)] bg-[var(--color-bg-1)]"
                  } ${isJackpot && !spinning ? "border-[var(--color-brand-500)]/60" : ""}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {sym}
                </div>
              ))}
            </div>

            {/* Win line indicator */}
            {!spinning && (
              <div className="mt-4 text-center text-[13px]">
                {reels[0] === reels[1] && reels[1] === reels[2] ? (
                  <span className="font-bold text-[var(--color-brand-500)]">
                    🎉 Three of a kind — {PAYOUTS[reels[0]]}× win!
                  </span>
                ) : reels[0] === reels[1] || reels[1] === reels[2] ? (
                  <span className="font-bold text-[var(--color-warn)]">
                    ✓ Two of a kind — half payout
                  </span>
                ) : (
                  <span className="text-[var(--color-ink-3)]">No match — try again</span>
                )}
              </div>
            )}
          </div>

          {/* Paytable */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Paytable</p>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
              {SYMBOLS.map((sym) => (
                <div key={sym} className="rounded-md bg-[var(--color-bg-1)] p-2 text-center">
                  <p className="text-2xl">{sym}</p>
                  <p className="mono mt-1 text-[11px] font-bold text-[var(--color-brand-500)]">{PAYOUTS[sym]}×</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">Payout = symbol multiplier × bet × 3 (3 of a kind). 🃏 Wild substitutes any symbol.</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Bet per spin (USDC)</label>
            <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40 mb-2">
              <span className="mono text-[var(--color-ink-3)]">$</span>
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="0.00"
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
                disabled={spinning || autoSpin}
              />
            </div>
            <div className="mb-4 grid grid-cols-4 gap-1">
              {[5, 10, 25, 50].map((v) => (
                <button key={v} onClick={() => setBet(String(v))} disabled={spinning || autoSpin}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)] disabled:opacity-40">
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={doSpin}
              disabled={spinning || autoSpin}
              className="mb-2 w-full rounded-md bg-[var(--color-brand-500)] py-3 text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {spinning ? "Spinning…" : "SPIN"}
            </button>
            <button
              onClick={toggleAuto}
              className={`w-full rounded-md py-2.5 text-[13px] font-bold transition-colors ${
                autoSpin
                  ? "bg-[var(--color-live)]/20 text-[var(--color-live)] border border-[var(--color-live)]/30"
                  : "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"
              }`}
            >
              {autoSpin ? "⏹ Stop Auto Spin" : "▶ Auto Spin"}
            </button>
          </div>

          {/* Session stats */}
          {history.length > 0 && (
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 space-y-2 text-[12px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Session</p>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Spins</span><span className="mono font-bold text-white">{stats.total}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Wins</span><span className="mono font-bold text-[var(--color-brand-500)]">{stats.wins}</span></div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Net P&L</span>
                <span className="mono font-bold" style={{ color: stats.netPnl >= 0 ? "var(--color-brand-500)" : "var(--color-live)" }}>
                  {stats.netPnl >= 0 ? "+" : ""}{stats.netPnl.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Win rate</span><span className="mono font-bold text-white">{stats.total ? ((stats.wins / stats.total) * 100).toFixed(0) : 0}%</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
