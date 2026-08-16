import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { houseEdgeBps } from "@/lib/server/casino";

export const runtime = "nodejs";

/**
 * Static casino game catalog. Source of truth lives in this file — these
 * are the games we have real provably-fair + on-chain implementations
 * for. Adding a new game means a new entry here + a new `resolveX`
 * function in [src/lib/server/casino.ts](src/lib/server/casino.ts).
 */
const GAMES = [
  { id: "crash",     name: "Crash",     category: "originals",      featured: true,  thumb: "/casino/crash.svg",     minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: houseEdgeBps.crash,     provider: "sportystake", providablyFair: true,  rules: "Cash out before the multiplier crashes." },
  { id: "dice",      name: "Dice",      category: "originals",      featured: true,  thumb: "/casino/dice.svg",      minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: houseEdgeBps.dice,      provider: "sportystake", providablyFair: true,  rules: "Pick over/under a target 1–98." },
  { id: "slots",     name: "Slots",     category: "slots",          featured: false, thumb: "/casino/slots.svg",     minBet: "1.000000", maxBet: "1000.000000", houseEdgeBps: houseEdgeBps.slots,     provider: "sportystake", providablyFair: true,  rules: "5-reel × 3-row symbol match." },
  { id: "roulette",  name: "Roulette",  category: "table",          featured: false, thumb: "/casino/roulette.svg",  minBet: "1.000000", maxBet: "2500.000000", houseEdgeBps: houseEdgeBps.roulette,  provider: "sportystake", providablyFair: true,  rules: "European single-zero." },
  { id: "blackjack", name: "Blackjack", category: "table",          featured: false, thumb: "/casino/blackjack.svg", minBet: "1.000000", maxBet: "2500.000000", houseEdgeBps: houseEdgeBps.blackjack, provider: "sportystake", providablyFair: true,  rules: "Single-deck, dealer stands on 17." },
  { id: "baccarat",  name: "Baccarat",  category: "table",          featured: false, thumb: "/casino/baccarat.svg",  minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: houseEdgeBps.baccarat,  provider: "sportystake", providablyFair: true,  rules: "Player / Banker / Tie." },
];

export const GET = withRequestId(async (_req: NextRequest) => {
  return ok({ items: GAMES });
});
