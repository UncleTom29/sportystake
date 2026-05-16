"use client";
import { useState, useCallback } from "react";
import { useNotifications } from "@/lib/notificationStore";

type DiceResult = { roll: number; win: boolean; payout: number; timestamp: number };

function calcMultiplier(threshold: number, mode: "over" | "under"): number {
  const winChance = mode === "over" ? (100 - threshold) / 100 : threshold / 100;
  return parseFloat(((0.97 / winChance)).toFixed(4));
}

function calcWinChance(threshold: number, mode: "over" | "under"): number {
  return mode === "over" ? 100 - threshold : threshold;
}

export default function DicePage() {
  const [threshold, setThreshold] = useState(50);
  const [mode, setMode] = useState<"over" | "under">("over");
  const [bet, setBet] = useState("10");
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [history, setHistory] = useState<DiceResult[]>([]);
  const { pushToast } = useNotifications();

  const mult = calcMultiplier(threshold, mode);
  const winChance = calcWinChance(threshold, mode);
  const payout = parseFloat((parseFloat(bet || "0") * mult).toFixed(2));

  const roll = useCallback(async () => {
    const amount = parseFloat(bet);
    if (!amount || amount <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet" }); return; }
    setRolling(true);
    setLastRoll(null);

    await new Promise((r) => setTimeout(r, 600));
    const rolled = Math.floor(Math.random() * 100) + 1;
    const won = mode === "over" ? rolled > threshold : rolled < threshold;
    const profit = won ? parseFloat((amount * mult - amount).toFixed(2)) : -amount;

    setLastRoll(rolled);
    setLastWin(won);
    setHistory((h) => [{ roll: rolled, win: won, payout: profit, timestamp: Date.now() }, ...h].slice(0, 20));
    setRolling(false);

    if (won) {
      pushToast({ kind: "success", title: `Rolled ${rolled} — You win!`, body: `+${profit.toFixed(2)} USDC` });
    } else {
      pushToast({ kind: "error", title: `Rolled ${rolled} — Better luck next time`, body: `-${amount.toFixed(2)} USDC` });
    }
  }, [bet, mode, mult, threshold, pushToast]);

  const winColor = lastWin === true ? "var(--color-brand-500)" : lastWin === false ? "var(--color-live)" : "var(--color-ink-3)";

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Dice</h1>
        <p className="text-[13px] text-[var(--color-ink-3)]">Predict high or low. Adjust the threshold to change odds.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Game panel */}
        <div className="space-y-4">
          {/* Roll result display */}
          <div className="flex h-48 items-center justify-center rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
            <div className="text-center">
              {rolling ? (
                <div className="flex flex-col items-center gap-3">
                  <DiceSVG rolling />
                  <p className="text-[13px] text-[var(--color-ink-3)]">Rolling…</p>
                </div>
              ) : lastRoll !== null ? (
                <div className="flex flex-col items-center gap-3">
                  <DiceSVG value={lastRoll} />
                  <p className="mono text-5xl font-black" style={{ color: winColor }}>{lastRoll}</p>
                  <p className="text-[13px] font-bold" style={{ color: winColor }}>
                    {lastWin ? "🎉 You Win!" : "💥 You Lose"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-40">
                  <DiceSVG />
                  <p className="text-[13px] text-[var(--color-ink-3)]">Roll to play</p>
                </div>
              )}
            </div>
          </div>

          {/* Threshold slider */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Threshold</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode("under")}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition-colors ${mode === "under" ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]" : "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"}`}
                >
                  Roll Under
                </button>
                <button
                  onClick={() => setMode("over")}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition-colors ${mode === "over" ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]" : "bg-[var(--color-bg-3)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"}`}
                >
                  Roll Over
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <input
                type="range"
                min={2}
                max={98}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[var(--color-brand-500)]"
                style={{ height: 8 }}
              />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-ink-3)]">
                <span>1</span>
                <span className="mono font-bold text-white text-[14px]">{threshold}</span>
                <span>100</span>
              </div>
            </div>

            {/* Visualizer */}
            <div className="mt-3 h-6 overflow-hidden rounded-full border border-[var(--color-line-1)]">
              <div className="flex h-full">
                <div
                  className="h-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{
                    width: `${threshold}%`,
                    background: mode === "under" ? "rgba(0,231,1,0.3)" : "rgba(255,45,45,0.2)",
                    color: mode === "under" ? "var(--color-brand-500)" : "var(--color-ink-3)",
                  }}
                >
                  {mode === "under" ? `WIN` : "LOSE"}
                </div>
                <div
                  className="h-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{
                    width: `${100 - threshold}%`,
                    background: mode === "over" ? "rgba(0,231,1,0.3)" : "rgba(255,45,45,0.2)",
                    color: mode === "over" ? "var(--color-brand-500)" : "var(--color-ink-3)",
                  }}
                >
                  {mode === "over" ? `WIN` : "LOSE"}
                </div>
              </div>
            </div>
          </div>

          {/* Roll history */}
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <span
                key={i}
                className="mono rounded px-2 py-1 text-[11px] font-bold"
                style={{
                  background: h.win ? "rgba(0,231,1,0.12)" : "rgba(255,45,45,0.12)",
                  color: h.win ? "var(--color-brand-500)" : "var(--color-live)",
                }}
              >
                {h.roll}
              </span>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Bet amount (USDC)</label>
            <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40 mb-2">
              <span className="mono text-[var(--color-ink-3)]">$</span>
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="0.00"
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
              />
            </div>
            <div className="mb-4 grid grid-cols-4 gap-1">
              {[5, 10, 50, 100].map((v) => (
                <button key={v} onClick={() => setBet(String(v))}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
                  {v}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="mb-4 space-y-2 rounded-md bg-[var(--color-bg-1)] p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Win chance</span>
                <span className="mono font-bold text-white">{winChance.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Multiplier</span>
                <span className="mono font-bold text-[var(--color-brand-500)]">{mult.toFixed(4)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">Payout on win</span>
                <span className="mono font-bold text-white">${payout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-3)]">House edge</span>
                <span className="mono font-bold text-white">3%</span>
              </div>
            </div>

            <button
              onClick={roll}
              disabled={rolling}
              className="w-full rounded-md bg-[var(--color-brand-500)] py-3 text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-wait disabled:opacity-70"
            >
              {rolling ? "Rolling…" : "Roll Dice"}
            </button>
          </div>

          {/* History table */}
          {history.length > 0 && (
            <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
              <div className="border-b border-[var(--color-line-1)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                Recent rolls
              </div>
              {history.slice(0, 8).map((h, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-2 text-[12px] last:border-0">
                  <span className="mono font-bold text-white">{h.roll}</span>
                  <span className="mono" style={{ color: h.win ? "var(--color-brand-500)" : "var(--color-live)" }}>
                    {h.win ? "+" : ""}{h.payout.toFixed(2)} USDC
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiceSVG({ value, rolling }: { value?: number; rolling?: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  const n = value ?? 6;
  const positions = dots[Math.min(6, Math.max(1, n))] ?? dots[6];

  return (
    <svg viewBox="0 0 100 100" className={`h-16 w-16 ${rolling ? "animate-spin" : ""}`}>
      <rect x="5" y="5" width="90" height="90" rx="16" fill="var(--color-bg-3)" stroke="var(--color-line-2)" strokeWidth="2" />
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="white" />
      ))}
    </svg>
  );
}
