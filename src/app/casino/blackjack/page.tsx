"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationStore";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import {
  placeCasinoBetOnchain,
  dealBlackjackWithRetry,
  getPendingCasinoBet,
} from "@/lib/placeCasinoBet";
import { Casino, type BlackjackHandResult } from "@/lib/api-client";

type Phase = "idle" | "dealing" | "player_turn" | "acting" | "resolved";

interface HandState {
  casinoBetId: string;
  actionSeq: number;
  txHash: string;
  clientSeed: string;
  betAmount: number;
  playerCards: number[];
  dealerUpCard?: number;
  dealerCards?: number[];
  outcome?: string;
  multiplier?: number;
  bonusGated?: boolean;
  payout?: string;
  win?: boolean;
}

const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];

function cardLabel(card: number) {
  const rank = card % 13;
  const suit = Math.floor(card / 13);
  return { rank: RANK_LABELS[rank], suit: SUIT_SYMBOLS[suit], red: suit === 1 || suit === 2 };
}

/** Display-only running total (soft-ace aware) — the server is always the
 *  authoritative source of the actual resolved outcome. */
function handTotal(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const rank = c % 13;
    if (rank === 0) { total += 11; aces += 1; }
    else if (rank >= 9) total += 10;
    else total += rank + 1;
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}

function applyResult(hand: HandState, res: BlackjackHandResult): HandState {
  return {
    ...hand,
    casinoBetId: res.casinoBetId,
    actionSeq: res.actionSeq,
    playerCards: res.playerHands[0]?.cards ?? hand.playerCards,
    dealerUpCard: res.dealerUpCard,
    dealerCards: res.dealerCards,
    outcome: res.outcome,
    multiplier: res.multiplier,
    bonusGated: res.bonusGated,
    payout: res.payout,
    win: res.win,
  };
}

export default function BlackjackPage() {
  const [betAmount, setBetAmount] = useState("10");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hand, setHand] = useState<HandState | null>(null);
  const [hasRecoverable, setHasRecoverable] = useState(false);
  const { pushToast } = useNotifications();
  const isAuthenticated = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();

  useEffect(() => {
    const pending = getPendingCasinoBet("blackjack");
    if (pending) setHasRecoverable(true);
  }, []);

  const resume = useCallback(async () => {
    const pending = getPendingCasinoBet("blackjack");
    if (!pending) return;
    setPhase("dealing");
    try {
      const res = await dealBlackjackWithRetry({ txHash: pending.txHash, clientSeed: pending.clientSeed });
      setHasRecoverable(false);
      const base: HandState = {
        casinoBetId: res.casinoBetId, actionSeq: res.actionSeq, txHash: pending.txHash,
        clientSeed: pending.clientSeed, betAmount: pending.amount, playerCards: [],
      };
      setHand(applyResult(base, res));
      setPhase(res.status === "resolved" ? "resolved" : "player_turn");
    } catch (err) {
      setPhase("idle");
      pushToast({ kind: "error", title: "Couldn't resume hand", body: (err as Error).message });
    }
  }, [pushToast]);

  const deal = useCallback(async () => {
    if (!isAuthenticated) { void signIn(); return; }
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) { pushToast({ kind: "warn", title: "Enter a valid bet amount" }); return; }

    setPhase("dealing");
    setHand(null);

    const clientSeed = crypto.randomUUID();
    let txHash: string;
    try {
      const tx = await placeCasinoBetOnchain({ amountUsdc: betAmount, game: "blackjack", clientSeed });
      txHash = tx.txHash;
    } catch (err) {
      pushToast({ kind: "warn", title: "On-chain deposit failed or cancelled", body: (err as Error).message });
      setPhase("idle");
      return;
    }

    try {
      const res = await dealBlackjackWithRetry({ txHash, clientSeed });
      const base: HandState = {
        casinoBetId: res.casinoBetId, actionSeq: res.actionSeq, txHash, clientSeed,
        betAmount: amt, playerCards: [],
      };
      const next = applyResult(base, res);
      setHand(next);
      if (res.status === "resolved") {
        setPhase("resolved");
        announceResult(next, amt, pushToast);
      } else {
        setPhase("player_turn");
      }
    } catch {
      setHasRecoverable(true);
      setPhase("idle");
      pushToast({
        kind: "error",
        title: "Settlement Delayed",
        body: `Deposit confirmed on-chain (Tx: ${txHash.slice(0, 8)}…), but dealing timed out. Your bet is safe — reload or hit "Resume hand" to continue.`,
      });
    }
  }, [betAmount, isAuthenticated, signIn, pushToast]);

  const act = useCallback(async (action: "hit" | "stand") => {
    if (!hand) return;
    setPhase("acting");
    try {
      const res = await Casino.blackjackAction({ casinoBetId: hand.casinoBetId, action, actionSeq: hand.actionSeq });
      const next = applyResult(hand, res);
      setHand(next);
      if (res.status === "resolved") {
        setPhase("resolved");
        announceResult(next, hand.betAmount, pushToast);
      } else {
        setPhase("player_turn");
      }
    } catch (err) {
      // Resync from the server via the idempotent deal call rather than
      // trusting stale local state after a conflict (e.g. a double-click
      // racing a prior action).
      try {
        const res = await dealBlackjackWithRetry({ txHash: hand.txHash, clientSeed: hand.clientSeed });
        const next = applyResult(hand, res);
        setHand(next);
        setPhase(res.status === "resolved" ? "resolved" : "player_turn");
      } catch {
        setPhase("player_turn");
      }
      pushToast({ kind: "error", title: "Action failed", body: (err as Error).message });
    }
  }, [hand, pushToast]);

  const newHand = useCallback(() => {
    setHand(null);
    setPhase("idle");
  }, []);

  const dealing = phase === "dealing";
  const playerTurn = phase === "player_turn";
  const acting = phase === "acting";
  const resolved = phase === "resolved";
  const playerLive = handTotal(hand?.playerCards ?? []);
  const dealerVisible = resolved ? hand?.dealerCards ?? [] : hand?.dealerUpCard !== undefined ? [hand.dealerUpCard] : [];
  const dealerLive = resolved ? handTotal(dealerVisible) : null;

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
      </div>

      {hasRecoverable && phase === "idle" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-3.5 text-xs text-white">
          <p className="font-bold text-white">You have a hand in progress.</p>
          <button
            onClick={() => void resume()}
            className="mono rounded-lg bg-[var(--color-warn)] px-3 py-1.5 font-black uppercase text-[var(--color-bg-0)] hover:bg-yellow-400"
          >
            Resume hand
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="relative flex min-h-[340px] flex-col items-center justify-center gap-8 overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
            {/* Dealer */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Dealer</p>
              <div className="flex gap-2">
                {dealerVisible.map((c, i) => <PlayingCard key={i} card={c} />)}
                {!resolved && (playerTurn || acting) && <PlayingCard faceDown />}
              </div>
              {resolved && dealerLive && (
                <p className="mono text-2xl font-black" style={{ color: dealerLive.total > 21 ? "var(--color-live)" : "white" }}>
                  {dealerLive.total}{dealerLive.total > 21 ? " (bust)" : ""}
                </p>
              )}
            </div>

            {/* Result banner */}
            {resolved && hand && (
              <div
                className="mono rounded-full px-4 py-1.5 text-[13px] font-black uppercase tracking-wider"
                style={{
                  background: hand.win ? "rgba(0,231,1,0.15)" : hand.outcome === "push" ? "rgba(255,176,32,0.15)" : "rgba(255,45,45,0.15)",
                  color: hand.win ? "var(--color-brand-500)" : hand.outcome === "push" ? "var(--color-warn)" : "var(--color-live)",
                }}
              >
                {hand.outcome === "player_blackjack" ? "Blackjack!" : hand.win ? "You win" : hand.outcome === "push" ? "Push" : "Dealer wins"}
              </div>
            )}
            {hand?.bonusGated && resolved && (
              <p className="text-[11px] text-[var(--color-ink-3)]">Paid 1:1 — the 3:2 bonus tier needed more reserve than the pool had free right now.</p>
            )}
            {dealing && <p className="text-[13px] text-[var(--color-ink-3)]">Dealing…</p>}
            {phase === "idle" && !hasRecoverable && <p className="text-[13px] text-[var(--color-ink-3)]">Place a bet to deal</p>}

            {/* Player */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                {(hand?.playerCards ?? []).map((c, i) => <PlayingCard key={i} card={c} accent />)}
              </div>
              {(playerTurn || acting || resolved) && hand && hand.playerCards.length > 0 && (
                <p className="mono text-2xl font-black" style={{ color: playerLive.total > 21 ? "var(--color-live)" : "white" }}>
                  {playerLive.total}{playerLive.soft && playerLive.total <= 21 ? " (soft)" : ""}{playerLive.total > 21 ? " (bust)" : ""}
                </p>
              )}
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">You</p>
            </div>

            {(playerTurn || acting) && (
              <div className="flex gap-2">
                <button
                  onClick={() => void act("hit")}
                  disabled={acting}
                  className="rounded-md bg-[var(--color-brand-500)] px-5 py-2.5 text-[13px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Hit
                </button>
                <button
                  onClick={() => void act("stand")}
                  disabled={acting}
                  className="rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-5 py-2.5 text-[13px] font-black uppercase tracking-wider text-white hover:bg-[var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Stand
                </button>
              </div>
            )}

            {resolved && (
              <button
                onClick={newHand}
                className="rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-5 py-2.5 text-[13px] font-black uppercase tracking-wider text-white hover:bg-[var(--color-bg-3)]"
              >
                New hand
              </button>
            )}
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
                disabled={phase !== "idle"}
                className="mono ml-2 w-full bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
              />
            </div>
            <div className="mb-4 grid grid-cols-4 gap-1">
              {[5, 10, 50, 100].map((v) => (
                <button key={v} onClick={() => setBetAmount(String(v))} disabled={phase !== "idle"}
                  className="mono rounded-md bg-[var(--color-bg-3)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
                  {v}
                </button>
              ))}
            </div>

            <div className="mb-4 space-y-2 rounded-md bg-[var(--color-bg-1)] p-3 text-[13px]">
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Blackjack</span><span className="mono font-bold text-[var(--color-brand-500)]">3:2</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Win</span><span className="mono font-bold text-white">1:1</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-3)]">Push</span><span className="mono font-bold text-white">Stake returned</span></div>
            </div>

            <button
              onClick={() => void deal()}
              disabled={phase !== "idle"}
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

type PushToast = (t: { kind: "info" | "success" | "warn" | "error"; title: string; body?: string }) => void;

function announceResult(hand: HandState, amt: number, pushToast: PushToast) {
  const payoutNum = parseFloat(hand.payout ?? "0");
  if (hand.win) {
    pushToast({
      kind: "success",
      title: hand.outcome === "player_blackjack" ? "Blackjack!" : "You win",
      body: `+${(payoutNum - amt).toFixed(2)} USDC`,
    });
  } else if (hand.outcome === "push") {
    pushToast({ kind: "info", title: "Push", body: "Stake returned" });
  } else {
    pushToast({ kind: "error", title: "Dealer wins", body: `-${amt.toFixed(2)} USDC` });
  }
}

function PlayingCard({ card, faceDown = false, accent = false }: { card?: number; faceDown?: boolean; accent?: boolean }) {
  if (faceDown || card === undefined) {
    return (
      <div
        className="relative h-20 w-14 rounded-md border-2"
        style={{
          borderColor: "var(--color-line-2)",
          background: "repeating-linear-gradient(45deg, var(--color-bg-3), var(--color-bg-3) 4px, var(--color-bg-4) 4px, var(--color-bg-4) 8px)",
        }}
      />
    );
  }
  const { rank, suit, red } = cardLabel(card);
  return (
    <div
      className="relative flex h-20 w-14 flex-col items-center justify-center gap-0.5 rounded-md border-2 bg-white"
      style={{ borderColor: accent ? "var(--color-brand-500)" : "var(--color-line-2)" }}
    >
      <span className="mono text-lg font-black leading-none" style={{ color: red ? "#dc2626" : "#0a0a0a" }}>{rank}</span>
      <span className="text-lg leading-none" style={{ color: red ? "#dc2626" : "#0a0a0a" }}>{suit}</span>
    </div>
  );
}
