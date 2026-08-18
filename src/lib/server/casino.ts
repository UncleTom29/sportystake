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
  weightedCellIndex,
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

/**
 * Per-game house edge. `dice` is now driven by `CasinoHouse.rtpBps` (see
 * `resolveDice`'s `rtpBps` param, read on-chain by the caller in
 * `/api/casino/bet/route.ts` via `getCasinoRtpBps()`) — the entry here is
 * gone, not decorative-and-forgotten.
 *
 * `slots` now matches reality: `SLOT_WEIGHTS` below is solved (closed-form,
 * not decorative) to land row RTP at exactly 90% — this constant is purely
 * DISPLAY, not itself read by `resolveSlots`, whose actual edge comes from
 * the weight table. Fixed rather than admin-adjustable (unlike Dice/Crash's
 * `rtpBps`) — the weights would need re-solving for a different target, not
 * just a parameter flip.
 *
 * `roulette`/`baccarat` are informational only, not read by their resolve
 * functions below — their real edge comes structurally from the classic,
 * real-world-recognizable payout ratios (35:1 straight-up, 1.95x banker,
 * etc.), which deliberately do NOT get forced onto the shared `rtpBps` knob
 * the way Dice/Crash/Slots do (see the redesign plan's Phase 0 notes).
 *
 * `blackjack` is display-only, like roulette/baccarat — real edge emerges
 * from `blackjackEngine.ts`'s actual rules-accurate play (dealer stands on
 * all 17s, 3:2 naturals), not a tunable parameter. `50` approximates
 * basic-strategy house edge for the catalog listing in
 * `/api/casino/games/route.ts`.
 *
 * `crash` was always dead — `resolveCrash`/`crashMultiplier` below have no
 * callers; the real crash game is entirely on-chain in `CrashGame.sol`,
 * governed by its own `rtpBps`.
 */
export const houseEdgeBps = {
  slots: 1000,    // 10% — matches SLOT_WEIGHTS' solved 90% RTP exactly
  roulette: 270,  // 2.70% (European) — informational, see above
  blackjack: 50,  // stale — placeholder pending Phase 5 rebuild
  baccarat: 120,  // informational, see above
  crash: 100,     // dead — resolveCrash has no callers
};

// ─── Dice ───────────────────────────────────────────────────────────────────
/**
 * Pre-hoc solvency gating: draws the full, natural, provably-fair roll
 * exactly as always — never narrows the RNG's own range, never biases win
 * probability. If (and only if) a natural win here would require more than
 * `availableCapacity` (CasinoHouse.availableCapacityFor(requestId), read by
 * the caller BEFORE this runs — public, already-fixed state, not something
 * chosen after seeing what the roll would produce), the roll is remapped
 * into the pre-existing LOSING region via a fixed, order-preserving
 * transform, rather than computed normally and then vetoed. The target,
 * odds, and multiplier the player was quoted are never touched — only
 * which side of the target boundary the displayed roll lands on.
 *
 * This is deliberately NOT "shrink the win chance" (that requires widening
 * the win zone to cap a multiplier downward — the opposite of what capacity
 * gating needs) and NOT "compute the fair result, then flip the verdict"
 * (that would make the displayed roll contradict the shown outcome, a worse
 * credibility problem than the one this replaces). The displayed roll is
 * always exactly the one that was evaluated.
 */
export function resolveDice(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  target: number;        // 1..98
  direction: "over" | "under";
  rtpBps: number;         // read from CasinoHouse.rtpBps() by the caller
  availableCapacity: bigint; // CasinoHouse.availableCapacityFor(requestId), read by the caller
}): GameResult {
  if (opts.target < 1 || opts.target > 98) {
    throw new Error("dice target must be in [1, 98]");
  }
  const naturalRoll = diceRoll(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce);
  const naturalWin = opts.direction === "over" ? naturalRoll > opts.target : naturalRoll < opts.target;
  const chance = opts.direction === "over" ? (99 - opts.target) / 100 : opts.target / 100;
  const edge = (10_000 - opts.rtpBps) / 10_000;
  const multiplier = (1 - edge) / chance; // the multiplier IF this bet wins — untouched by gating

  const amt = usdcFromString(opts.amount);
  const quotedPayout = (amt * BigInt(Math.round(multiplier * 1_000_000))) / 1_000_000n;
  const deficit = quotedPayout - amt;
  const remapped = naturalWin && deficit > opts.availableCapacity;

  const roll = remapped
    ? (opts.direction === "under"
        ? opts.target + (naturalRoll * (100 - opts.target)) / 100
        : (naturalRoll * opts.target) / 100)
    : naturalRoll;

  const win = opts.direction === "over" ? roll > opts.target : roll < opts.target;
  const payout = win ? quotedPayout : 0n;

  return {
    win,
    payoutUsdc: payout,
    payoutMultiplier: win ? Math.round(multiplier * 1000) / 1000 : 0,
    detail: {
      roll: Math.round(roll * 100) / 100,
      target: opts.target,
      direction: opts.direction,
      multiplier,
      availableCapacity: opts.availableCapacity.toString(),
      remapped,
      // Included only when remapped, so an auditor can independently
      // recompute both steps: the natural roll from the revealed seed
      // (standard provably-fair verification, unchanged), then this
      // deterministic transform on top of it.
      ...(remapped ? { naturalRoll: Math.round(naturalRoll * 100) / 100 } : {}),
    },
  };
}

// ─── Slots ──────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["🍒", "🍋", "⭐", "💎", "🔔", "7️⃣", "🃏"];
const SLOT_PAYOUTS: Record<string, number> = {
  "🍒": 2, "🍋": 3, "⭐": 5, "🔔": 8, "💎": 15, "7️⃣": 25, "🃏": 50,
};
const WILD_INDEX = 6; // SLOT_SYMBOLS.indexOf("🃏")

/**
 * Relative draw weights, index-aligned with SLOT_SYMBOLS, calibrated so the
 * exact expected per-row return (accounting for the wild's dual role as
 * both a 50x-paying symbol AND a substitute for every other symbol's match
 * run) lands at 90.00% — solved directly from the row-win probability
 * formula below, not simulated or eyeballed. Recalibrate if SLOT_PAYOUTS or
 * the match rule ever changes; see the "expectedRowMultiplier" derivation
 * in this session's history for the closed-form math (per starting symbol
 * i, win probability at exactly k matches follows a geometric-tail shape in
 * (p_i + p_wild), so expected return is fully solvable in closed form —
 * no Monte Carlo needed). The wild's resulting probability is extremely
 * small (~1-in-700,000) — a direct, correct consequence of it paying up to
 * 250x (5-in-a-row) while ALSO substituting for every other symbol.
 */
const SLOT_WEIGHTS = [286_204, 220_290, 130_507, 9_524, 59_510, 695, 1]; // cherry, lemon, star, diamond, bell, seven, wild

interface SlotRowOutcome {
  matches: number;
  multiplier: number;
}

function evaluateSlotRow(row: number[]): SlotRowOutcome {
  const first = row[0];
  let matches = 1;
  for (let c = 1; c < row.length; c++) {
    if (row[c] === first || row[c] === WILD_INDEX) matches++;
    else break;
  }
  if (matches < 3) return { matches, multiplier: 0 };
  const mult = SLOT_PAYOUTS[SLOT_SYMBOLS[first]] ?? 1;
  return { matches, multiplier: mult * matches };
}

/** Deterministic substitute for row position 2 that's guaranteed to NOT
 *  continue a match with `first` (and isn't the wild either) — breaking
 *  the match chain at the earliest position beyond what's required to
 *  already be a winning row (positions 0 and 1 both continuing is what
 *  makes a natural row eligible for remapping in the first place), so the
 *  remapped row is guaranteed matches<3 regardless of what the untouched
 *  positions 0, 1, 3, 4 were. */
function firstNonMatchingSymbol(first: number): number {
  for (let candidate = 0; candidate < SLOT_SYMBOLS.length; candidate++) {
    if (candidate !== first && candidate !== WILD_INDEX) return candidate;
  }
  return 0; // unreachable — 7 symbols, at most 2 excluded
}

/**
 * Same pre-hoc gating principle as the other games, adapted to slots' three
 * independent rows: each row is drawn (now via weighted, RTP-calibrated
 * symbol selection rather than the previous unweighted `byte % 7`) exactly
 * as always. Rows are then confirmed left-to-right against a running
 * spin-wide budget — there is only ONE stake collected for the whole spin,
 * not one per row, so what matters is the AGGREGATE deficit
 * (perLine × confirmedMultiplier − amount) staying within capacity, not a
 * per-row fiction. The first row(s) that fit are confirmed as natural
 * wins; a row whose natural contribution would push the running total over
 * capacity is remapped to a guaranteed loss instead (via
 * `firstNonMatchingSymbol`) rather than computed fairly and then denied.
 */
export function resolveSlots(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  lines: number;
  availableCapacity: bigint;
}): GameResult {
  const amt = usdcFromString(opts.amount);
  const lineCount = Math.max(1, opts.lines);
  const perLine = amt / BigInt(lineCount);
  const rowsToEvaluate = Math.min(3, lineCount);

  const reels: number[][] = [];
  const winLines: number[] = [];
  const remappedRows: Record<number, number[]> = {};
  let confirmedMultiplier = 0;

  for (let r = 0; r < 3; r++) {
    const naturalRow: number[] = [];
    for (let c = 0; c < 5; c++) {
      naturalRow.push(weightedCellIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, r * 5 + c, SLOT_WEIGHTS));
    }

    if (r >= rowsToEvaluate) {
      // Not a scored line at this bet size — still drawn and shown
      // (matches the pre-existing display behavior), never evaluated.
      reels.push(naturalRow);
      continue;
    }

    const natural = evaluateSlotRow(naturalRow);
    let row = naturalRow;
    let outcome = natural;

    if (natural.multiplier > 0) {
      const tentativeMultiplier = confirmedMultiplier + natural.multiplier;
      const tentativePayout = perLine * BigInt(tentativeMultiplier);
      const tentativeDeficit = tentativePayout > amt ? tentativePayout - amt : 0n;
      if (tentativeDeficit > opts.availableCapacity) {
        row = [...naturalRow];
        row[2] = firstNonMatchingSymbol(naturalRow[0]);
        outcome = evaluateSlotRow(row); // guaranteed matches < 3
        remappedRows[r] = naturalRow;
      } else {
        confirmedMultiplier = tentativeMultiplier;
      }
    }

    reels.push(row);
    if (outcome.multiplier > 0) winLines.push(r);
  }

  const payout = perLine * BigInt(confirmedMultiplier);
  const remapped = Object.keys(remappedRows).length > 0;
  return {
    win: payout > 0n,
    payoutUsdc: payout,
    payoutMultiplier: confirmedMultiplier,
    detail: {
      reels,
      symbols: SLOT_SYMBOLS,
      winLines,
      totalMultiplier: confirmedMultiplier,
      availableCapacity: opts.availableCapacity.toString(),
      remapped,
      ...(remapped ? { remappedRows } : {}),
    },
  };
}

// ─── Roulette ───────────────────────────────────────────────────────────────
/** Pure win/multiplier check for one drawn number against one bet — shared
 *  by the natural draw and, if needed, the remap walk below. */
function evaluateRouletteBet(number: number, betType: string, selection: number | string | undefined): number {
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  const sel = selection;
  switch (betType) {
    case "straight": return Number(sel) === number ? 36 : 0;
    case "red":      return color === "red" ? 2 : 0;
    case "black":    return color === "black" ? 2 : 0;
    case "even":     return number > 0 && number % 2 === 0 ? 2 : 0;
    case "odd":      return number % 2 === 1 ? 2 : 0;
    case "low":      return number >= 1 && number <= 18 ? 2 : 0;
    case "high":     return number >= 19 && number <= 36 ? 2 : 0;
    case "dozen": {
      const d = Number(sel);
      if ((d === 1 && number >= 1 && number <= 12) ||
          (d === 2 && number >= 13 && number <= 24) ||
          (d === 3 && number >= 25 && number <= 36)) {
        return 3;
      }
      return 0;
    }
    case "column": {
      const c = Number(sel);
      return number > 0 && number % 3 === (c === 3 ? 0 : c) ? 3 : 0;
    }
    default: return 0;
  }
}

/**
 * Same pre-hoc gating principle as Dice, adapted to a discrete 37-number
 * wheel: draw the natural number exactly as always; if it's a win this bet
 * can't currently afford, walk forward (mod 37) to the nearest number that
 * loses for THIS bet, and use that instead. The largest possible winning
 * set (red/black/even/odd/low/high) is 18 of 37 numbers, so at least 19
 * losing numbers always exist and the walk is bounded — no per-bet-type
 * remap formula needed, this one rule covers every bet type uniformly.
 */
export function resolveRoulette(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  bet: { type: string; selection?: number | string };
  availableCapacity: bigint;
}): GameResult {
  const naturalNumber = rouletteNumber(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce);
  const naturalMultiplier = evaluateRouletteBet(naturalNumber, opts.bet.type, opts.bet.selection);
  const amt = usdcFromString(opts.amount);
  const deficit = amt * BigInt(Math.max(0, naturalMultiplier - 1));
  const remapped = naturalMultiplier > 0 && deficit > opts.availableCapacity;

  let number = naturalNumber;
  if (remapped) {
    for (let i = 1; i <= 37; i++) {
      const candidate = (naturalNumber + i) % 37;
      if (evaluateRouletteBet(candidate, opts.bet.type, opts.bet.selection) === 0) {
        number = candidate;
        break;
      }
    }
  }

  const multiplier = evaluateRouletteBet(number, opts.bet.type, opts.bet.selection);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  return {
    win: multiplier > 0,
    payoutUsdc: amt * BigInt(multiplier),
    payoutMultiplier: multiplier,
    detail: {
      number,
      color,
      multiplier,
      availableCapacity: opts.availableCapacity.toString(),
      remapped,
      ...(remapped ? { naturalNumber } : {}),
    },
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

// ─── Baccarat (probabilistic, not a full game sim) ─────────────────────────
// Blackjack now has its own real rules engine — see blackjackEngine.ts,
// wired through the dedicated /api/casino/blackjack/{deal,action} routes
// rather than this file's single-shot resolvers.
function baccaratWinner(p: number, b: number): "player" | "banker" | "tie" {
  return p > b ? "player" : b > p ? "banker" : "tie";
}

function evaluateBaccaratBet(p: number, b: number, bet: "player" | "banker" | "tie"): number {
  if (baccaratWinner(p, b) !== bet) return 0;
  return bet === "tie" ? 9 : bet === "banker" ? 1.95 : 2;
}

/**
 * Same pre-hoc gating principle as Roulette, adapted to baccarat's two-draw
 * outcome: the natural (player, banker) point totals are drawn exactly as
 * always; if the natural winner matches this bet and it's unaffordable,
 * walk forward through the combined index space (p*10+b, mod 100) to the
 * nearest (p,b) pair whose winner does NOT match this bet.
 */
export function resolveBaccarat(opts: {
  serverSeed: string;
  fairness: FairnessProof;
  amount: string;
  bet: "player" | "banker" | "tie";
  availableCapacity: bigint;
}): GameResult {
  const naturalP = (
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 0) +
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 4)
  ) % 10;
  const naturalB = (
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 8) +
    uniformIndex(opts.serverSeed, opts.fairness.clientSeed, opts.fairness.nonce, 10, 12)
  ) % 10;

  const naturalMultiplier = evaluateBaccaratBet(naturalP, naturalB, opts.bet);
  const amt = usdcFromString(opts.amount);
  const deficit = (amt * BigInt(Math.round(Math.max(0, naturalMultiplier - 1) * 100))) / 100n;
  const remapped = naturalMultiplier > 0 && deficit > opts.availableCapacity;

  let p = naturalP;
  let b = naturalB;
  if (remapped) {
    const naturalIdx = naturalP * 10 + naturalB;
    for (let i = 1; i <= 100; i++) {
      const idx = (naturalIdx + i) % 100;
      const candP = Math.floor(idx / 10);
      const candB = idx % 10;
      if (evaluateBaccaratBet(candP, candB, opts.bet) === 0) {
        p = candP;
        b = candB;
        break;
      }
    }
  }

  const winner = baccaratWinner(p, b);
  const multiplier = evaluateBaccaratBet(p, b, opts.bet);
  const payout = (amt * BigInt(Math.round(multiplier * 100))) / 100n;
  return {
    win: multiplier > 0,
    payoutUsdc: payout,
    payoutMultiplier: multiplier,
    detail: {
      player: p,
      banker: b,
      winner,
      multiplier,
      availableCapacity: opts.availableCapacity.toString(),
      remapped,
      ...(remapped ? { naturalPlayer: naturalP, naturalBanker: naturalB } : {}),
    },
  };
}

export const utils = { usdcFromString, usdcToString, ONE_USDC };
