import { utils } from "@/lib/server/store";

export interface CasinoOutcome {
  win: boolean;
  payout: string;        // USDC decimal
  detail: Record<string, unknown>;
}

export function rollDice(amount: string, target: number, direction: "over" | "under"): CasinoOutcome {
  if (target < 1 || target > 98) throw new Error("target must be 1..98");
  const roll = Math.floor(Math.random() * 10000) / 100;
  const win = direction === "over" ? roll > target : roll < target;
  const chance = direction === "over" ? (99 - target) / 100 : target / 100;
  const houseEdge = 0.01;
  const multiplier = win ? (1 - houseEdge) / chance : 0;
  const amt = utils.fromUsdc(amount);
  const payout = (amt * BigInt(Math.round(multiplier * 1000))) / 1000n;
  return { win, payout: utils.toUsdc(payout), detail: { roll, target, direction, multiplier: Math.round(multiplier * 100) / 100 } };
}

const SYMBOLS = ["🍒", "🍋", "⭐", "💎", "🔔", "7️⃣", "🃏"];
const SYMBOL_PAYOUTS: Record<string, number> = { "🍒": 2, "🍋": 3, "⭐": 5, "🔔": 8, "💎": 15, "7️⃣": 25, "🃏": 50 };

export function spinSlots(amount: string, lines: number): CasinoOutcome {
  const cols = 5, rows = 3;
  const reels: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.floor(Math.random() * SYMBOLS.length)));
  const winLines: number[] = [];
  let totalPayout = 0;
  for (let r = 0; r < Math.min(rows, lines); r++) {
    const first = reels[r][0];
    let matches = 1;
    for (let c = 1; c < cols; c++) {
      if (reels[r][c] === first || reels[r][c] === 6 /* wild */) matches++;
      else break;
    }
    if (matches >= 3) {
      winLines.push(r);
      const sym = SYMBOLS[first];
      const mult = SYMBOL_PAYOUTS[sym] ?? 1;
      totalPayout += mult * matches;
    }
  }
  const amt = utils.fromUsdc(amount);
  const perLineStake = amt / BigInt(Math.max(1, lines));
  const totalWin = perLineStake * BigInt(Math.round(totalPayout * 1000)) / 1000n;
  return {
    win: totalWin > 0n,
    payout: utils.toUsdc(totalWin),
    detail: { reels, symbols: SYMBOLS, winLines, totalMultiplier: totalPayout },
  };
}

export function playRoulette(amount: string, bet: { type: string; selection: number | string }): CasinoOutcome {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");
  const amt = utils.fromUsdc(amount);
  let multiplier = 0;
  if (bet.type === "straight" && Number(bet.selection) === number) multiplier = 36;
  else if (bet.type === "red" && color === "red") multiplier = 2;
  else if (bet.type === "black" && color === "black") multiplier = 2;
  else if (bet.type === "even" && number > 0 && number % 2 === 0) multiplier = 2;
  else if (bet.type === "odd" && number % 2 === 1) multiplier = 2;
  else if (bet.type === "low" && number >= 1 && number <= 18) multiplier = 2;
  else if (bet.type === "high" && number >= 19 && number <= 36) multiplier = 2;
  else if (bet.type === "dozen") {
    const d = Number(bet.selection);
    if (d === 1 && number >= 1 && number <= 12) multiplier = 3;
    else if (d === 2 && number >= 13 && number <= 24) multiplier = 3;
    else if (d === 3 && number >= 25 && number <= 36) multiplier = 3;
  } else if (bet.type === "column") {
    const c = Number(bet.selection);
    if (number > 0 && number % 3 === (c === 3 ? 0 : c)) multiplier = 3;
  }
  const payout = (amt * BigInt(multiplier));
  return { win: multiplier > 0, payout: utils.toUsdc(payout), detail: { number, color, multiplier } };
}

export function playBlackjack(amount: string): CasinoOutcome {
  const draw = () => Math.min(11, 1 + Math.floor(Math.random() * 13));
  let player = draw() + draw();
  let dealer = draw() + draw();
  while (player < 17 && Math.random() < 0.6) player += draw();
  while (dealer < 17) dealer += draw();
  const playerBust = player > 21;
  const dealerBust = dealer > 21;
  let multiplier = 0;
  if (playerBust) multiplier = 0;
  else if (dealerBust || player > dealer) multiplier = 2;
  else if (player === dealer) multiplier = 1;
  const amt = utils.fromUsdc(amount);
  return { win: multiplier > 1, payout: utils.toUsdc(amt * BigInt(multiplier)), detail: { player, dealer, playerBust, dealerBust } };
}

export function playBaccarat(amount: string, bet: "player" | "banker" | "tie"): CasinoOutcome {
  const draw = () => Math.floor(Math.random() * 10);
  const player = (draw() + draw()) % 10;
  const banker = (draw() + draw()) % 10;
  const winner = player > banker ? "player" : banker > player ? "banker" : "tie";
  let multiplier = 0;
  if (winner === bet) multiplier = bet === "tie" ? 9 : bet === "banker" ? 1.95 : 2;
  const amt = utils.fromUsdc(amount);
  const payout = (amt * BigInt(Math.round(multiplier * 100))) / 100n;
  return { win: multiplier > 0, payout: utils.toUsdc(payout), detail: { player, banker, winner, multiplier } };
}
