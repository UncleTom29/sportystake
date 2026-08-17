"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationStore";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { Casino } from "@/lib/api-client";
import type { OnchainCrashRound } from "@/lib/api-client";
import { joinCrashRound, cashOutCrashRound, claimCrashPayout, getPendingCrashPayout, getMyCrashEntry } from "@/lib/crashClient";
import { formatUsdc } from "../../../../packages/sdk/src/utils";

type Phase = "waiting" | "running" | "crashed";

// Mirrors crash-scheduler.worker.ts's GROWTH_RATE exactly. The crash point
// itself is committed server-side (serverSeedHash) and only revealed at
// resolve — but the live climbing multiplier during "running" is a public,
// deterministic function of elapsed time, so the client can render it
// smoothly between polls without knowing the answer early.
const GROWTH_RATE = 0.07;
const POLL_MS = 1000;
const WAIT_WINDOW_MS = 15 * 60 * 1000; // 15-minute betting window (matches worker's WAIT_MS)
const CUTOFF_SECONDS = 5; // Cutoff 5s before lock to prevent race-condition reverts

function formatCountdown(sec: number): string {
  if (sec <= 0) return "0s";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

interface MyBet {
  roundId: number;
  amountUsdc: number;
  autoCashoutX100: number;
  cashedOutAtX100: number | null;
}

export default function AviatorPage() {
  const [round, setRound] = useState<OnchainCrashRound | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdownSec, setCountdownSec] = useState(0);
  const [betAmount, setBetAmount] = useState("10");
  const [autoCashout, setAutoCashout] = useState("2.00");
  const [useAutoCashout, setUseAutoCashout] = useState(false);
  const [myBet, setMyBet] = useState<MyBet | null>(null);
  const [pendingPayout, setPendingPayout] = useState<bigint>(0n);
  const [busy, setBusy] = useState<"idle" | "betting" | "cashing" | "claiming">("idle");
  const { pushToast } = useNotifications();
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const address = useWallet((s) => s.address);
  const { signIn } = usePrivyLogin();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundRef = useRef<OnchainCrashRound | null>(null);
  roundRef.current = round;

  // Spribe Aviator Canvas Renderer: Red Propeller Monoplane ✈️ + Crimson Altitude Trail
  const drawAviatorFrame = useCallback((mult: number, phase: Phase, targetMult: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Dark Crimson Radar Grid Background
    ctx.clearRect(0, 0, W, H);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#160710");
    bgGrad.addColorStop(1, "#0d0408");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Grid Lines
    ctx.strokeStyle = "rgba(255, 45, 85, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 5) * i);
      ctx.lineTo(W, (H / 5) * i);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo((W / 6) * i, 0);
      ctx.lineTo((W / 6) * i, H);
      ctx.stroke();
    }

    if (phase === "waiting") {
      // Waiting phase radar pulse
      const centerPulse = (Date.now() % 1500) / 1500;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 40 + centerPulse * 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 45, 85, ${0.4 - centerPulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    // Bezier Altitude Curve Points
    const maxMult = Math.max(targetMult, 3.0);
    const progress = Math.min(1.0, (mult - 1.0) / (maxMult - 1.0));
    const endX = W * 0.08 + progress * W * 0.82;
    const endY = H * 0.90 - Math.pow(progress, 0.75) * H * 0.78;

    // Crimson Altitude Fill
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, phase === "crashed" ? "rgba(255, 45, 85, 0.35)" : "rgba(225, 29, 72, 0.25)");
    fillGrad.addColorStop(1, "rgba(225, 29, 72, 0.0)");

    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.90);
    ctx.quadraticCurveTo(W * 0.40, H * 0.88, endX, endY);
    ctx.lineTo(endX, H * 0.90);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Crimson Curve Stroke Line
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.90);
    ctx.quadraticCurveTo(W * 0.40, H * 0.88, endX, endY);
    ctx.strokeStyle = phase === "crashed" ? "#ff2d55" : "#e11d48";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.stroke();

    if (phase === "running") {
      // Draw Red Flying Monoplane Airplane ✈️
      ctx.save();
      ctx.translate(endX, endY);

      // Angle plane along flight slope
      const slopeAngle = -Math.atan2(H * 0.78 * 0.75, W * 0.82) * 0.6;
      ctx.rotate(slopeAngle);

      // Thrust particles
      for (let p = 0; p < 5; p++) {
        const px = -20 - p * 6 - (Date.now() % 200) / 20;
        const py = (Math.random() - 0.5) * 6;
        ctx.beginPath();
        ctx.arc(px, py, 3 - p * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 45, 85, ${0.8 - p * 0.15})`;
        ctx.fill();
      }

      // Airplane Body
      ctx.fillStyle = "#ff2d55";
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -8);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      ctx.fill();

      // Wing
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-2, -12);
      ctx.lineTo(4, 0);
      ctx.lineTo(-2, 12);
      ctx.closePath();
      ctx.fill();

      // Propeller glow
      ctx.beginPath();
      ctx.arc(18, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore();
    } else if (phase === "crashed") {
      // Crash explosion particles
      ctx.save();
      ctx.translate(endX, endY);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const dist = 15 + ((Date.now() % 500) / 500) * 25;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ff2d55";
        ctx.fill();
      }
      ctx.restore();
    }
  }, []);

  // Poll the real, operator-driven round state (crash-scheduler.worker.ts ->
  // Redis -> /api/casino/crash/state). This is the only source of truth for
  // round id / phase / timing — nothing here is computed or guessed locally.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await Casino.crashState();
        if (cancelled) return;
        setRound(res.round);
        if (res.history.length) setHistory(res.history);
      } catch {
        // transient network/redis hiccup — keep last known state, retry next tick
      }
    }
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // A bet only stays relevant for the round it was placed in — once the
  // worker moves on to a new roundId, that bet has already been reconciled
  // (won/lost) server-side.
  useEffect(() => {
    if (round && myBet && round.id !== myBet.roundId) {
      setMyBet(null);
    }
  }, [round, myBet]);

  // `myBet` only ever lives in local React state, set after a join
  // completes — so it's blank on every fresh page load, and also stays
  // blank if joinRound confirmed on-chain but the follow-up
  // Casino.crashJoin() recording call then failed (network hiccup, etc.).
  // Either way the UI would otherwise show "no bet yet" for a round the
  // wallet has already joined, letting the user submit a second join that
  // CrashGame correctly (but confusingly) rejects with AlreadyJoined().
  // The contract is the real source of truth here, so check it directly
  // whenever the active round changes.
  useEffect(() => {
    if (!isAuthenticated || !address || !round) return;
    let cancelled = false;
    getMyCrashEntry(round.id, address)
      .then((entry) => {
        if (cancelled || !entry) return;
        setMyBet((prev) =>
          prev && prev.roundId === round.id
            ? prev
            : {
                roundId: round.id,
                amountUsdc: Number(formatUsdc(entry.amount, 6)),
                autoCashoutX100: entry.autoCashoutX100,
                cashedOutAtX100: entry.cashedOutAtX100,
              },
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, address, round?.id]);

  // Re-check the on-chain pending payout whenever a round just resolved (a
  // win credits `pendingPayout` at that point) or on sign-in.
  useEffect(() => {
    if (!isAuthenticated || !address) return;
    let cancelled = false;
    getPendingCrashPayout(address)
      .then((p) => { if (!cancelled) setPendingPayout(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, address, round?.status]);

  // Smooth per-frame animation, driven entirely by the real `round` state:
  // live multiplier = e^(GROWTH_RATE * secondsSinceStartedAt), matching the
  // worker's own flight-duration formula exactly. Once the round is
  // confirmed crashed, snap to the server's authoritative crashMultiplierX100.
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const r = roundRef.current;
      if (!r) {
        animId = requestAnimationFrame(tick);
        return;
      }

      if (r.status === "waiting") {
        setMultiplier(1.0);
        setCountdownSec(Math.max(1, Math.ceil((WAIT_WINDOW_MS - (Date.now() - r.waitingSince)) / 1000)));
        drawAviatorFrame(1.0, "waiting", 2.0);
      } else if (r.status === "running" && r.startedAt) {
        const elapsedSeconds = Math.max(0, (Date.now() - r.startedAt) / 1000);
        const live = Math.exp(GROWTH_RATE * elapsedSeconds);
        setMultiplier(live);
        drawAviatorFrame(live, "running", Math.max(live, 2.0));

        // Auto-cashout is enforced on-chain/by the worker's resolve-time
        // reconciliation (autoCashoutX100 was passed into joinRound) — this
        // is display-only, so the UI doesn't show a stale "cash out" button
        // once the threshold has clearly passed.
      } else if (r.status === "crashed") {
        const final = (r.crashMultiplierX100 ?? 100) / 100;
        setMultiplier(final);
        drawAviatorFrame(final, "crashed", final);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [drawAviatorFrame]);

  const placeBet = async () => {
    if (!isAuthenticated) { void signIn(); return; }
    if (!round || round.status !== "waiting") {
      pushToast({ kind: "warn", title: "Wait for the next round to open" });
      return;
    }
    if (countdownSec <= CUTOFF_SECONDS) {
      pushToast({ kind: "warn", title: "Round closing — wait for the next round" });
      return;
    }
    if (myBet && myBet.roundId === round.id) {
      pushToast({ kind: "warn", title: "You've already placed a bet this round" });
      return;
    }
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet amount" }); return; }

    setBusy("betting");
    try {
      const roundId = round.id;
      // Belt-and-suspenders against the on-chain-succeeded-but-not-yet-
      // rehydrated-locally window (the effect above polls, it isn't
      // instant) — re-check the contract directly right before signing.
      if (address) {
        const existing = await getMyCrashEntry(roundId, address).catch(() => null);
        if (existing) {
          setMyBet({
            roundId,
            amountUsdc: Number(formatUsdc(existing.amount, 6)),
            autoCashoutX100: existing.autoCashoutX100,
            cashedOutAtX100: existing.cashedOutAtX100,
          });
          pushToast({ kind: "warn", title: "You've already placed a bet this round" });
          setBusy("idle");
          return;
        }
      }
      const clientSeed = crypto.randomUUID();
      const autoCashoutX100 = useAutoCashout && autoCashout ? Math.round(parseFloat(autoCashout) * 100) : 0;

      // Signs + confirms CrashGame.joinRound via the user's wallet, then
      // records the verified on-chain receipt server-side. These are two
      // separate failure modes: if the tx itself never confirms, nothing
      // happened on-chain and it's a genuine failure. If it confirms but
      // the recording call afterward fails, the bet is real — the wallet
      // is on-chain for this round regardless of what our own API says —
      // so that path must not tell the user it failed.
      const { txHash } = await joinCrashRound({ roundId, amountUsdc: amt, autoCashoutX100 });
      try {
        await Casino.crashJoin(txHash, clientSeed);
      } catch (recordErr) {
        console.error("[crash] on-chain join confirmed but server recording failed:", recordErr);
      }

      setMyBet({ roundId, amountUsdc: amt, autoCashoutX100, cashedOutAtX100: null });
      pushToast({
        kind: "success",
        title: `Bet Placed: $${amt.toFixed(2)} USDC`,
        body: `Staked for Aviator Round #${roundId}.`,
      });
    } catch (e) {
      pushToast({ kind: "error", title: "Bet failed", body: (e as Error).message });
    } finally {
      setBusy("idle");
    }
  };

  const doCashout = async () => {
    if (!round || round.status !== "running" || !myBet || myBet.roundId !== round.id || myBet.cashedOutAtX100 !== null) return;
    setBusy("cashing");
    try {
      const currentMultX100 = Math.round(multiplier * 100);

      // Signs + confirms CrashGame.cashOut, then records the verified receipt.
      const { txHash } = await cashOutCrashRound({ roundId: round.id, multiplierX100: currentMultX100 });
      await Casino.crashCashout(txHash);

      setMyBet((b) => (b ? { ...b, cashedOutAtX100: currentMultX100 } : b));
      const payout = (myBet.amountUsdc * currentMultX100) / 100;
      pushToast({
        kind: "success",
        title: `Cashed Out at ${(currentMultX100 / 100).toFixed(2)}×!`,
        body: `+$${(payout - myBet.amountUsdc).toFixed(2)} USDC profit.`,
      });
    } catch (e) {
      pushToast({ kind: "error", title: "Cashout failed", body: (e as Error).message });
    } finally {
      setBusy("idle");
    }
  };

  const doClaim = async () => {
    setBusy("claiming");
    try {
      // Signs + confirms CrashGame.claim() — a separate pull-payment step
      // for whatever has accumulated across resolved rounds.
      const { txHash } = await claimCrashPayout();
      const res = await Casino.crashClaim(txHash);
      setPendingPayout(0n);
      pushToast({ kind: "success", title: `Claimed $${res.amount} USDC` });
    } catch (e) {
      pushToast({ kind: "error", title: "Claim failed", body: (e as Error).message });
    } finally {
      setBusy("idle");
    }
  };

  const phase: Phase = round?.status ?? "waiting";
  const roundUnavailable = round === null;
  const hasActiveBet = !!myBet && myBet.roundId === round?.id;
  const isCutoff = phase === "waiting" && countdownSec <= CUTOFF_SECONDS;
  const canCashout = hasActiveBet && phase === "running" && myBet?.cashedOutAtX100 === null;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2">
            <Link
              href="/casino"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-bg-3)] hover:border-[var(--color-line-2)]"
            >
              ← Back to Casino
            </Link>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            ✈️ Aviator
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)]">
            Watch the red plane climb. Cash out before it flies away! Provably fair on-chain RNG.
          </p>
        </div>
        {pendingPayout > 0n && (
          <button
            onClick={() => void doClaim()}
            disabled={busy === "claiming"}
            className="rounded-xl bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] shadow-lg disabled:opacity-60"
          >
            {busy === "claiming" ? "Claiming…" : `Claim $${formatUsdc(pendingPayout)} USDC`}
          </button>
        )}
      </div>

      {/* History Bar */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-none rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-2.5">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1">
          History:
        </span>
        {history.map((h100, i) => {
          const h = h100 / 100;
          return (
            <span
              key={i}
              className="mono shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black border border-white/5"
              style={{
                background: h < 2 ? "rgba(255,45,85,0.15)" : h < 5 ? "rgba(255,176,32,0.15)" : "rgba(0,231,1,0.15)",
                color: h < 2 ? "#ff2d55" : h < 5 ? "var(--color-warn)" : "var(--color-brand-500)",
              }}
            >
              {h.toFixed(2)}×
            </span>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Main Flight Display */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-[#ff2d55]/30 bg-[#0d0408] shadow-2xl" style={{ aspectRatio: "16/9" }}>
            <canvas ref={canvasRef} width={800} height={450} className="absolute inset-0 h-full w-full" />

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {roundUnavailable && (
                <div className="text-center space-y-2">
                  <span className="mono text-2xl font-black text-white/60">Connecting…</span>
                  <p className="mono text-xs font-bold uppercase tracking-widest text-[var(--color-ink-3)]">
                    Waiting for round data
                  </p>
                </div>
              )}

              {!roundUnavailable && phase === "waiting" && (
                <div className="text-center space-y-2">
                  <span className="mono text-5xl md:text-6xl font-black text-white drop-shadow-md">
                    {formatCountdown(countdownSec)}
                  </span>
                  <p className={`mono text-xs font-bold uppercase tracking-widest ${isCutoff ? "text-yellow-400" : "text-[#ff2d55]"} animate-pulse`}>
                    {isCutoff ? "TAKING OFF SOON... BETTING CLOSED" : "NEXT TAKEOFF IN PROGRESS... PLACE YOUR BETS"}
                  </p>
                </div>
              )}

              {phase === "running" && (
                <div className="text-center">
                  <p className="mono text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-xl">
                    {multiplier.toFixed(2)}×
                  </p>
                </div>
              )}

              {phase === "crashed" && (
                <div className="text-center space-y-1">
                  <p className="text-4xl md:text-5xl font-black uppercase text-[#ff2d55] tracking-widest drop-shadow-lg animate-bounce">
                    FLEW AWAY!
                  </p>
                  <p className="mono text-2xl font-black text-white/80">
                    @{multiplier.toFixed(2)}×
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dual Bet Panel (Spribe Aviator Style) */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-white">Place Bet</span>
              <span className="mono text-xs text-[var(--color-ink-3)]">Round #{round?.id ?? "—"}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-ink-3)] uppercase">Bet Amount (USDC)</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white font-bold">$</span>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="10.00"
                    className="mono w-full rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-2.5 pl-8 pr-3 text-sm font-bold text-white focus:border-[#ff2d55] focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {["5", "10", "25", "50"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    className="mono rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] py-1.5 text-xs font-bold text-white hover:bg-[var(--color-bg-3)]"
                  >
                    ${v}
                  </button>
                ))}
              </div>

              {/* Auto Cashout Controls */}
              <div className="rounded-xl bg-[var(--color-bg-1)] p-3 border border-[var(--color-line-1)] space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-bold uppercase text-white">Auto Cashout</span>
                  <input
                    type="checkbox"
                    checked={useAutoCashout}
                    onChange={(e) => setUseAutoCashout(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#ff2d55]"
                  />
                </label>

                {useAutoCashout && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="mono text-xs font-bold text-[var(--color-ink-3)]">At</span>
                    <input
                      type="number"
                      step="0.1"
                      value={autoCashout}
                      onChange={(e) => setAutoCashout(e.target.value)}
                      className="mono w-full rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-2 py-1 text-xs font-bold text-white focus:outline-none"
                    />
                    <span className="mono text-xs font-bold text-white">×</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {canCashout ? (
                <button
                  onClick={() => void doCashout()}
                  disabled={busy === "cashing"}
                  className="w-full rounded-xl bg-[var(--color-warn)] py-3.5 text-sm font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 animate-pulse"
                >
                  {busy === "cashing" ? "Cashing Out…" : `CASH OUT $${((myBet?.amountUsdc ?? 0) * multiplier).toFixed(2)}`}
                </button>
              ) : (
                <button
                  onClick={() => void placeBet()}
                  disabled={busy === "betting" || hasActiveBet || roundUnavailable || phase !== "waiting" || isCutoff}
                  className="w-full rounded-xl bg-[#ff2d55] py-3.5 text-sm font-black uppercase tracking-wider text-white hover:bg-[#e11d48] shadow-lg shadow-red-500/20 disabled:opacity-60"
                >
                  {roundUnavailable
                    ? "CONNECTING…"
                    : hasActiveBet
                      ? "BET PLACED (READY)"
                      : busy === "betting"
                        ? "PLACING BET…"
                        : isCutoff
                          ? "ROUND CLOSING (CUTOFF)…"
                          : phase === "waiting"
                            ? "BET FOR NEXT ROUND"
                            : "ROUND IN PROGRESS…"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
