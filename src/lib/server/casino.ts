/**
 * Provably-fair casino game resolutions.
 * Replaces the `Math.random()`-based legacy implementation in casino-sim.ts.
 *
 * Every game returns an outcome AND the verification metadata so the route
 * can persist it to `CasinoBet` (already in the Prisma schema).
 */
import {
  crashMultiplier,
  diceRoll,
  rouletteNumber,
  slotReels,
  uniformIndex,
} from "./provably-fair";

const ONE_USDC = 1_000_000n;

export interface FairnessProof {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface GameResult {
  win: boolean;
  payoutUsdc: bigint;
  payoutMultiplier: number;
  detail: Record<string, unknown>;
}

function usdcFromString(s: string): bigint {
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * ONE_USDC + BigInt(padded || "0");
}

function usdcToString(n: bigint): string {
  const whole = n / ONE_USDC;
  const frac = (n % ONE_USDC).toString().padStart(6, "0");
  return `${whole.toString()}.${frac}`;
}

export const houseEdgeBps = {
  dice: 100,      // 1%
  slots: 350,     // 3.5%
  roulette: 270,  // 2.70% (European)
  blackjack: 50,
  baccarat: 120,
  crash: 100,
};

// ─── Dice ───────────────────────────────────────────────────────────────────
export function resolveDice(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  target: number;        // 1..98
  direction: "over" | "under";
}): GameResult {
  if (opts.target < 1 || opts.target > 98) {
    throw new Error("dice target must be in [1, 98]");
  }
  const roll = diceRoll(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce);
  const win = opts.direction === "over" ? roll > opts.target : roll < opts.target;
  const chance = opts.direction === "over" ? (99 - opts.target) / 100 : opts.target / 100;
  const edge = houseEdgeBps.dice / 10_000;
  const multiplier = win ? (1 - edge) / chance : 0;
  const amt = usdcFromString(opts.amount);
  const payout = (amt * BigInt(Math.round(multiplier * 1_000_000))) / 1_000_000n;
  return {
    win,
    payoutUsdc: payout,
    payoutMultiplier: Math.round(multiplier * 1000) / 1000,
    detail: { roll: Math.round(roll * 100) / 100, target: opts.target, direction: opts.direction, multiplier },
  };
}

// ─── Slots ──────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["🍒", "🍋", "⭐", "💎", "🔔", "7️⃣", "🃏"];
const SLOT_PAYOUTS: Record<string, number> = {
  "🍒": 2, "🍋": 3, "⭐": 5, "🔔": 8, "💎": 15, "7️⃣": 25, "🃏": 50,
};

export function resolveSlots(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  lines: number;
}): GameResult {
  const reels = slotReels(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, SLOT_SYMBOLS.length);
  const cols = reels[0].length;
  const winLines: number[] = [];
  let totalMultiplier = 0;
  for (let r = 0; r < Math.min(reels.length, opts.lines); r++) {
    const first = reels[r][0];
    let matches = 1;
    for (let c = 1; c < cols; c++) {
      if (reels[r][c] === first || reels[r][c] === 6 /* wild */) matches++;
      else break;
    }
    if (matches >= 3) {
      winLines.push(r);
      const sym = SLOT_SYMBOLS[first];
      const mult = SLOT_PAYOUTS[sym] ?? 1;
      totalMultiplier += mult * matches;
    }
  }
  const amt = usdcFromString(opts.amount);
  const perLine = amt / BigInt(Math.max(1, opts.lines));
  const payout = perLine * BigInt(Math.round(totalMultiplier * 1000)) / 1000n;
  return {
    win: payout > 0n,
    payoutUsdc: payout,
    payoutMultiplier: totalMultiplier,
    detail: { reels, symbols: SLOT_SYMBOLS, winLines, totalMultiplier },
  };
}

// ─── Roulette ───────────────────────────────────────────────────────────────
export function resolveRoulette(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  bet: { type: string; selection?: number | string };
}): GameResult {
  const number = rouletteNumber(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let multiplier = 0;
  const sel = opts.bet.selection;
  switch (opts.bet.type) {
    case "straight": if (Number(sel) === number) multiplier = 36; break;
    case "red":      if (color === "red") multiplier = 2; break;
    case "black":    if (color === "black") multiplier = 2; break;
    case "even":     if (number > 0 && number % 2 === 0) multiplier = 2; break;
    case "odd":      if (number % 2 === 1) multiplier = 2; break;
    case "low":      if (number >= 1 && number <= 18) multiplier = 2; break;
    case "high":     if (number >= 19 && number <= 36) multiplier = 2; break;
    case "dozen": {
      const d = Number(sel);
      if ((d === 1 && number >= 1 && number <= 12) ||
          (d === 2 && number >= 13 && number <= 24) ||
          (d === 3 && number >= 25 && number <= 36)) {
        multiplier = 3;
      }
      break;
    }
    case "column": {
      const c = Number(sel);
      if (number > 0 && number % 3 === (c === 3 ? 0 : c)) multiplier = 3;
      break;
    }
    default: multiplier = 0;
  }
  const amt = usdcFromString(opts.amount);
  return {
    win: multiplier > 0,
    payoutUsdc: amt * BigInt(multiplier),
    payoutMultiplier: multiplier,
    detail: { number, color, multiplier },
  };
}

// ─── Crash ──────────────────────────────────────────────────────────────────
export function resolveCrash(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  cashoutAtX100?: number;   // 0 = held to bust
  autoCashoutX100?: number; // pre-committed auto-cashout
}): GameResult & { crashAt: number } {
  const crashAt = crashMultiplier(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce);
  const cashAt100 = opts.cashoutAtX100 ?? opts.autoCashoutX100 ?? 0;
  const win = cashAt100 > 100 && cashAt100 / 100 <= crashAt;
  const multiplier = win ? cashAt100 / 100 : 0;
  const amt = usdcFromString(opts.amount);
  const payout = (amt * BigInt(Math.round(multiplier * 1000))) / 1000n;
  return {
    win,
    payoutUsdc: payout,
    payoutMultiplier: multiplier,
    crashAt,
    detail: { crashAt, cashoutAtX100: cashAt100 },
  };
}

// ─── Blackjack / Baccarat (probabilistic, not full game sims) ──────────────
export function resolveBlackjack(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
}): GameResult {
  // Draw using the provably-fair byte stream — 4 cards.
  const a = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 0) + 1;
  const b = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 4) + 1;
  const c = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 8) + 1;
  const d = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 12) + 1;
  let player = a + b;
  let dealer = c + d;
  // Simple play: player hits if <17 with 50% prob; dealer hits to 17.
  if (player < 17) {
    const e = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 16) + 1;
    player += e;
  }
  while (dealer < 17) {
    const f = uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 11, 20) + 1;
    dealer += f;
    if (dealer >= 17) break;
  }
  const playerBust = player > 21;
  const dealerBust = dealer > 21;
  let multiplier = 0;
  if (playerBust) multiplier = 0;
  else if (dealerBust || player > dealer) multiplier = 2;
  else if (player === dealer) multiplier = 1;
  const amt = usdcFromString(opts.amount);
  return {
    win: multiplier > 1,
    payoutUsdc: amt * BigInt(multiplier),
    payoutMultiplier: multiplier,
    detail: { player, dealer, playerBust, dealerBust },
  };
}

export function resolveBaccarat(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  bet: "player" | "banker" | "tie";
}): GameResult {
  const p = (
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 0) +
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 4)
  ) % 10;
  const b = (
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 8) +
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 12)
  ) % 10;
  const winner = p > b ? "player" : b > p ? "banker" : "tie";
  let multiplier = 0;
  if (winner === opts.bet) {
    multiplier = opts.bet === "tie" ? 9 : opts.bet === "banker" ? 1.95 : 2;
  }
  const amt = usdcFromString(opts.amount);
  const payout = (amt * BigInt(Math.round(multiplier * 100))) / 100n;
  return {
    win: multiplier > 0,
    payoutUsdc: payout,
    payoutMultiplier: multiplier,
    detail: { player: p, banker: b, winner, multiplier },
  };
}

export const utils = { usdcFromString, usdcToString, ONE_USDC };
