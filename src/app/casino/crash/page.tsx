"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNotifications } from "@/lib/notificationStore";

type Phase = "waiting" | "running" | "crashed";
type Player = { id: string; handle: string; bet: number; cashout: number | null; profit: number | null };

const HISTORY = [1.24, 5.82, 1.02, 14.4, 2.37, 1.09, 7.71, 3.03, 1.58, 22.4,
  1.19, 9.44, 1.03, 4.17, 2.88, 1.31, 6.62, 1.47, 18.0, 1.83];

const MOCK_PLAYERS: Player[] = [
  { id: "p1", handle: "0x4a…91bc", bet: 100, cashout: null, profit: null },
  { id: "p2", handle: "CryptoApe.eth", bet: 50, cashout: null, profit: null },
  { id: "p3", handle: "0x7f…22d1", bet: 250, cashout: null, profit: null },
  { id: "p4", handle: "MoonShot99", bet: 20, cashout: null, profit: null },
  { id: "p5", handle: "GoalMachine", bet: 75, cashout: null, profit: null },
];

function calcCrashPoint(round: number): number {
  const seed = ((round * 6364136223846793005 + 1442695040888963407) >>> 0) / 4294967296;
  if (seed < 0.04) return 1.0;
  return Math.max(1.0, Math.floor((1 / (1 - seed)) * 100) / 100);
}

export default function CrashPage() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashAt, setCrashAt] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [round, setRound] = useState(1);
  const [betAmount, setBetAmount] = useState("");
  const [autoCashout, setAutoCashout] = useState("");
  const [useAutoCashout, setUseAutoCashout] = useState(false);
  const [activeBet, setActiveBet] = useState<number | null>(null);
  const [cashedOut, setCashedOut] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [history, setHistory] = useState<number[]>(HISTORY);
  const { pushToast } = useNotifications();
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCurve = useCallback((mult: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((W / 5) * i, 0); ctx.lineTo((W / 5) * i, H); ctx.stroke();
    }

    const maxMult = Math.max(mult + 0.5, 3);
    const points: [number, number][] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const m = Math.pow(Math.E, t * Math.log(mult));
      if (m > mult) break;
      const x = t * W;
      const y = H - ((m - 1) / (maxMult - 1)) * H * 0.85 - H * 0.05;
      points.push([x, Math.max(5, Math.min(H - 5, y))]);
    }

    if (points.length < 2) return;

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, crashed ? "rgba(255,45,45,0.25)" : "rgba(0,231,1,0.20)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(0, H);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.strokeStyle = crashed ? "#ff2d2d" : "#00e701";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // Rocket dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last[0], last[1], 6, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? "#ff2d2d" : "#00e701";
    ctx.fill();
  }, []);

  const runRound = useCallback(() => {
    const cp = calcCrashPoint(round);
    setCrashAt(cp);
    setPhase("running");
    setMultiplier(1.0);
    setCashedOut(null);
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      const m = Math.min(Math.pow(Math.E, elapsed * 0.7), cp);
      setMultiplier(parseFloat(m.toFixed(2)));
      drawCurve(m, false);

      // Auto cashout for mock players
      setPlayers((prev) => prev.map((p) => {
        if (p.cashout !== null) return p;
        if (p.id !== "p1" && m >= p.bet / 30) {
          return { ...p, cashout: m, profit: parseFloat((p.bet * m - p.bet).toFixed(2)) };
        }
        return p;
      }));

      if (m >= cp) {
        setPhase("crashed");
        drawCurve(cp, true);
        setHistory((h) => [cp, ...h].slice(0, 20));
        // Settle players
        setPlayers((prev) => prev.map((p) => ({
          ...p,
          cashout: p.cashout ?? 0,
          profit: p.cashout ? parseFloat((p.bet * p.cashout - p.bet).toFixed(2)) : -p.bet,
        })));
        // If user had active bet and didn't cash out
        if (activeBet !== null && cashedOut === null) {
          setActiveBet(null);
          pushToast({ kind: "error", title: `Crashed at ${cp.toFixed(2)}×`, body: `Lost ${activeBet} USDC` });
        }
        setTimeout(() => startCountdown(), 1500);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [round, activeBet, cashedOut, drawCurve, pushToast]);

  const startCountdown = useCallback(() => {
    setPhase("waiting");
    setMultiplier(1.0);
    setCountdown(5);
    setRound((r) => r + 1);
    setActiveBet(null);
    setPlayers(MOCK_PLAYERS.map((p) => ({ ...p, cashout: null, profit: null })));
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); runRound(); return 0; }
        return c - 1;
      });
    }, 1000);
  }, [runRound]);

  useEffect(() => {
    const t = setTimeout(() => runRound(), 5000);
    const cd = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => { clearTimeout(t); clearInterval(cd); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeBet = () => {
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet amount" }); return; }
    if (phase !== "waiting") { pushToast({ kind: "warn", title: "Wait for next round" }); return; }
    setActiveBet(amt);
    setPlayers((prev) => [
      { id: "me", handle: "You", bet: amt, cashout: null, profit: null },
      ...prev.slice(0, 4),
    ]);
    pushToast({ kind: "success", title: `Bet placed: ${amt} USDC` });
  };

  const doCashout = () => {
    if (activeBet === null || phase !== "running") return;
    const payout = parseFloat((activeBet * multiplier).toFixed(2));
    setCashedOut(multiplier);
    setActiveBet(null);
    setPlayers((prev) => prev.map((p) =>
      p.id === "me" ? { ...p, cashout: multiplier, profit: parseFloat((payout - (activeBet ?? 0)).toFixed(2)) } : p
    ));
    pushToast({ kind: "success", title: `Cashed out at ${multiplier.toFixed(2)}×`, body: `+${(payout - activeBet).toFixed(2)} USDC profit` });
  };

  const multColor = phase === "crashed" ? "var(--color-live)" : multiplier >= 5 ? "var(--color-warn)" : multiplier >= 2 ? "var(--color-brand-500)" : "white";

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Round history */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">History</span>
        {history.map((h, i) => (
          <span
            key={i}
            className="mono shrink-0 rounded px-2 py-1 text-[11px] font-bold"
            style={{
              background: h < 2 ? "rgba(255,45,45,0.15)" : h < 5 ? "rgba(255,176,32,0.15)" : "rgba(0,231,1,0.15)",
              color: h < 2 ? "var(--color-live)" : h < 5 ? "var(--color-warn)" : "var(--color-brand-500)",
            }}
          >
            {h.toFixed(2)}×
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Game canvas */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[#060e14]" style={{ aspectRatio: "16/7" }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={350}
              className="absolute inset-0 h-full w-full"
            />
            {/* Multiplier overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {phase === "waiting" ? (
                <div className="text-center">
                  <p className="mono text-6xl font-black text-white">{countdown}s</p>
                  <p className="mt-2 text-[13px] text-[var(--color-ink-3)]">Next round starting…</p>
                </div>
              ) : phase === "crashed" ? (
                <div className="text-center animate-bounce">
                  <p className="mono text-[clamp(40px,8vw,80px)] font-black text-[var(--color-live)]">
                    CRASHED
                  </p>
                  <p className="mono text-2xl font-black text-white">{crashAt.toFixed(2)}×</p>
                </div>
              ) : (
                <div className="text-center">
                  <p
                    className="mono text-[clamp(56px,10vw,100px)] font-black leading-none transition-colors"
                    style={{ color: multColor }}
                  >
                    {multiplier.toFixed(2)}×
                  </p>
                  {cashedOut !== null && (
                    <div className="mt-2 rounded-md bg-[var(--color-brand-500)]/10 px-4 py-2 text-[14px] font-bold text-[var(--color-brand-500)]">
                      ✓ Cashed out at {cashedOut.toFixed(2)}×
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Players table */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
            <div className="grid grid-cols-4 border-b border-[var(--color-line-1)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
              <span>Player</span><span>Bet</span><span>Cashout</span><span>Profit</span>
            </div>
            {players.map((p) => (
              <div key={p.id} className={`grid grid-cols-4 items-center border-b border-[var(--color-line-1)] px-4 py-2.5 text-[12px] last:border-0 ${p.id === "me" ? "bg-[var(--color-brand-500)]/5" : ""}`}>
                <span className="font-bold text-white truncate">{p.handle}</span>
                <span className="mono text-[var(--color-ink-2)]">${p.bet}</span>
                <span className="mono font-bold" style={{ color: p.cashout ? "var(--color-brand-500)" : "var(--color-ink-3)" }}>
                  {p.cashout ? `${p.cashout.toFixed(2)}×` : phase === "running" ? "—" : "bust"}
                </span>
                <span className="mono font-bold" style={{ color: p.profit != null ? (p.profit >= 0 ? "var(--color-brand-500)" : "var(--color-live)") : "var(--color-ink-3)" }}>
                  {p.profit != null ? `${p.profit >= 0 ? "+" : ""}$${p.profit.toFixed(2)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Place bet</p>

            <label className="mb-1 block text-[11px] text-[var(--color-ink-3)]">Bet amount (USDC)</label>
            <div className="flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-3 focus-within:border-[var(--color-brand-500)]/40 mb-2">
              <span className="mono text-[var(--color-ink-3)]">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
                disabled={phase !== "waiting" && activeBet !== null}
              />
            </div>
            <div className="mb-3 grid grid-cols-4 gap-1">
              {[10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setBetAmount(String(v))}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]"
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAutoCashout}
                  onChange={(e) => setUseAutoCashout(e.target.checked)}
                  className="accent-[var(--color-brand-500)]"
                />
                <span className="text-[12px] text-[var(--color-ink-2)]">Auto cashout at</span>
                <input
                  type="number"
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(e.target.value)}
                  placeholder="2.00×"
                  disabled={!useAutoCashout}
                  className="mono w-20 rounded bg-[var(--color-bg-1)] px-2 py-1 text-[12px] font-bold text-white outline-none disabled:opacity-40"
                />
              </label>
            </div>

            {activeBet !== null && phase === "running" ? (
              <button
                onClick={doCashout}
                className="w-full rounded-md bg-[var(--color-live)] py-3 text-[14px] font-black uppercase tracking-wider text-white hover:bg-red-500"
              >
                Cash Out · {(activeBet * multiplier).toFixed(2)} USDC
              </button>
            ) : (
              <button
                onClick={placeBet}
                disabled={phase === "running"}
                className="w-full rounded-md bg-[var(--color-brand-500)] py-3 text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "waiting" ? "Bet next round" : activeBet ? "Betting…" : "Waiting…"}
              </button>
            )}
          </div>

          {/* Round info */}
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 space-y-2 text-[12px]">
            <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Round</span><span className="mono font-bold text-white">#{round}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">House edge</span><span className="mono font-bold text-white">3%</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Max payout</span><span className="mono font-bold text-white">$50,000</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Provably fair</span><span className="mono font-bold text-[var(--color-brand-500)]">✓ On-chain VRF</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
