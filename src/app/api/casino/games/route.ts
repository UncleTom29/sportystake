import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { houseEdgeBps } from "@/lib/server/casino";
import { getCasinoRtpBps } from "@/lib/server/casinoOnchain";

export const runtime = "nodejs";

/**
 * Static casino game catalog. Source of truth lives in this file — these
 * are the games we have real provably-fair + on-chain implementations
 * for. Adding a new game means a new entry here + a new `resolveX`
 * function in [src/lib/server/casino.ts](src/lib/server/casino.ts).
 *
 * Dice's `houseEdgeBps` is the one live, on-chain-governed figure here —
 * read fresh per request (`getCasinoRtpBps`) rather than a constant, so
 * this catalog can never drift from what `resolveDice` actually pays.
 * Everything else stays a static constant per `casino.ts`'s own
 * `houseEdgeBps` doc comment (slots pending its Phase 4 rebuild, roulette/
 * baccarat informational-only by design, blackjack pending Phase 5,
 * crash always dead here — CrashGame.sol has its own separate `rtpBps`).
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  const diceRtpBps = await getCasinoRtpBps();
  const games = [
    { id: "crash",     name: "Crash",     category: "originals",      featured: true,  thumb: "/casino/crash.svg",     minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: houseEdgeBps.crash,     provider: "sportystake", providablyFair: true,  rules: "Cash out before the multiplier crashes." },
    { id: "dice",      name: "Dice",      category: "originals",      featured: true,  thumb: "/casino/dice.svg",      minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: 10_000 - diceRtpBps,    provider: "sportystake", providablyFair: true,  rules: "Pick over/under a target 1–98." },
    { id: "slots",     name: "Slots",     category: "slots",          featured: false, thumb: "/casino/slots.svg",     minBet: "1.000000", maxBet: "1000.000000", houseEdgeBps: houseEdgeBps.slots,     provider: "sportystake", providablyFair: true,  rules: "5-reel × 3-row symbol match." },
    { id: "roulette",  name: "Roulette",  category: "table",          featured: false, thumb: "/casino/roulette.svg",  minBet: "1.000000", maxBet: "2500.000000", houseEdgeBps: houseEdgeBps.roulette,  provider: "sportystake", providablyFair: true,  rules: "European single-zero." },
    { id: "blackjack", name: "Blackjack", category: "table",          featured: false, thumb: "/casino/blackjack.svg", minBet: "1.000000", maxBet: "2500.000000", houseEdgeBps: houseEdgeBps.blackjack, provider: "sportystake", providablyFair: true,  rules: "Single-deck, dealer stands on 17." },
    { id: "baccarat",  name: "Baccarat",  category: "table",          featured: false, thumb: "/casino/baccarat.svg",  minBet: "1.000000", maxBet: "5000.000000", houseEdgeBps: houseEdgeBps.baccarat,  provider: "sportystake", providablyFair: true,  rules: "Player / Banker / Tie." },
  ];
  return ok({ items: games });
});
