/**
 * Real-rules blackjack: standard 52-card probabilities (cards encoded
 * 0..51, `rank = card % 13` 0=Ace..12=King, `suit = floor(card/13)` 0..3 —
 * suit never affects scoring, only display), dealer stands on all 17s,
 * natural blackjack pays 3:2 (subject to the same capacity gating as every
 * other game — see resolveBlackjackHand's caller). No double or split yet:
 * both require collecting additional on-chain funds mid-hand, which
 * CasinoHouse has no function for today (placeCasinoBet always creates a
 * new, independent bet) — building that is a separable follow-up, not
 * something to half-implement in a way that would be free positive-EV for
 * players (doubling without doubling the amount actually at risk). The
 * schema (`playerHands` as an array) is already shaped to add split later
 * without another migration.
 */
import { uniformIndex } from "./provably-fair";

export type BlackjackAction = "hit" | "stand";

export interface PlayerHandState {
  cards: number[];
  done: boolean;
}

export interface DealerHandState {
  cards: number[];
}

export function rankOf(card: number): number {
  return card % 13; // 0=Ace, 1..8=2..9, 9=10, 10=Jack, 11=Queen, 12=King
}

export function suitOf(card: number): number {
  return Math.floor(card / 13); // 0..3 — display only, never affects scoring
}

/** Hand total with soft-ace handling (Aces count as 11 unless that busts). */
export function handValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = rankOf(card);
    if (rank === 0) {
      total += 11;
      aces += 1;
    } else if (rank >= 9) {
      total += 10; // 10, J, Q, K
    } else {
      total += rank + 1; // 2..9
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBust(cards: number[]): boolean {
  return handValue(cards).total > 21;
}

/** A natural blackjack is exactly 2 cards totaling 21 — not any 21. */
export function isNaturalBlackjack(cards: number[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Standard "stand on all 17s" rule, including soft 17. */
export function dealerShouldHit(cards: number[]): boolean {
  return handValue(cards).total < 17;
}

/**
 * Draws one card not already used this hand, starting from `startCursor`.
 * Each cursor position derives its OWN independent HMAC digest (clientSeed
 * suffixed with `:card{cursor}`) rather than carving up one shared digest —
 * same reasoning as provably-fair.ts's `weightedCellIndex` for slots: a
 * hand can need more independent draws than one 32-byte digest's 8
 * four-byte windows provide, and cursor-only reuse of `uniformIndex` would
 * silently collide past that point. On a same-card collision, tries the
 * next cursor — collision probability per draw is at most (cards already
 * used)/52, so this converges quickly for any realistically-sized hand.
 */
export function drawCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  usedCards: ReadonlySet<number>,
  startCursor: number,
): { card: number; nextCursor: number } {
  let cursor = startCursor;
  for (let attempts = 0; attempts < 1000; attempts++) {
    const card = uniformIndex(serverSeed, `${clientSeed}:card${cursor}`, nonce, 52, 0);
    cursor += 1;
    if (!usedCards.has(card)) {
      return { card, nextCursor: cursor };
    }
  }
  // Unreachable in practice — a hand realistically never sees more than a
  // handful of cards out of 52, so 1000 collision-retries is astronomically
  // conservative headroom, not a real limit.
  throw new Error("drawCard: exhausted retry budget — this should never happen");
}

/** Deals the initial 2+2 (player, dealer) for a fresh hand. */
export function dealInitial(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): { playerCards: number[]; dealerCards: number[]; cursor: number } {
  const used = new Set<number>();
  let cursor = 0;
  const playerCards: number[] = [];
  const dealerCards: number[] = [];
  for (let i = 0; i < 2; i++) {
    const p = drawCard(serverSeed, clientSeed, nonce, used, cursor);
    used.add(p.card);
    playerCards.push(p.card);
    cursor = p.nextCursor;

    const d = drawCard(serverSeed, clientSeed, nonce, used, cursor);
    used.add(d.card);
    dealerCards.push(d.card);
    cursor = d.nextCursor;
  }
  return { playerCards, dealerCards, cursor };
}

/** Plays the dealer's hand out fully (hits until standing), given the
 *  player's already-finished cards (needed only to seed `usedCards`). */
export function playDealer(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  dealerCards: number[],
  playerCards: number[],
  startCursor: number,
): { cards: number[]; cursor: number } {
  const used = new Set<number>([...dealerCards, ...playerCards]);
  const cards = [...dealerCards];
  let cursor = startCursor;
  while (dealerShouldHit(cards)) {
    const draw = drawCard(serverSeed, clientSeed, nonce, used, cursor);
    used.add(draw.card);
    cards.push(draw.card);
    cursor = draw.nextCursor;
  }
  return { cards, cursor };
}

export type HandOutcome = "player_blackjack" | "push" | "player_win" | "dealer_win";

/** Rules-correct outcome for a COMPLETE hand (player has stood or busted,
 *  dealer has played out if applicable). Multiplier is relative to stake —
 *  1 = stake returned (push), 0 = total loss, 2 = 1:1 win, 2.5 = 3:2
 *  blackjack (before any capacity gating the caller applies). */
export function evaluateHand(playerCards: number[], dealerCards: number[]): { outcome: HandOutcome; multiplier: number } {
  const playerBusted = isBust(playerCards);
  const playerBJ = isNaturalBlackjack(playerCards);
  const dealerBJ = isNaturalBlackjack(dealerCards);

  if (playerBusted) return { outcome: "dealer_win", multiplier: 0 };
  if (playerBJ && dealerBJ) return { outcome: "push", multiplier: 1 };
  if (playerBJ) return { outcome: "player_blackjack", multiplier: 2.5 };
  if (dealerBJ) return { outcome: "dealer_win", multiplier: 0 };

  const dealerBusted = isBust(dealerCards);
  if (dealerBusted) return { outcome: "player_win", multiplier: 2 };

  const player = handValue(playerCards).total;
  const dealer = handValue(dealerCards).total;
  if (player > dealer) return { outcome: "player_win", multiplier: 2 };
  if (player < dealer) return { outcome: "dealer_win", multiplier: 0 };
  return { outcome: "push", multiplier: 1 };
}
