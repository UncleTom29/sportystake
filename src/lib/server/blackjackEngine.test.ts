import { describe, it, expect } from "vitest";
import {
  handValue,
  isBust,
  isNaturalBlackjack,
  dealerShouldHit,
  evaluateHand,
  drawCard,
  dealInitial,
  playDealer,
} from "./blackjackEngine";

// Card encoding: 0..51, rank = card % 13 (0=Ace..8=9, 9=10, 10=J, 11=Q, 12=K),
// suit = floor(card/13) (never affects scoring). Any suit works for these
// pure-math tests, so fixtures below just pick convenient indices.

describe("handValue", () => {
  it("counts face cards as 10", () => {
    expect(handValue([9, 22]).total).toBe(20); // 10 + 10
  });

  it("counts an ace as 11 when it doesn't bust", () => {
    const v = handValue([0, 12]); // Ace + King
    expect(v.total).toBe(21);
    expect(v.soft).toBe(true);
  });

  it("reduces aces from 11 to 1 one at a time to avoid busting", () => {
    // Three aces: naive 11*3=33 -> reduce two of them -> 11+1+1=13.
    const v = handValue([0, 13, 26]);
    expect(v.total).toBe(13);
    expect(v.soft).toBe(true); // one ace still counted as 11
  });

  it("reports soft=false once every ace has been reduced to 1", () => {
    // Ace + 9 + 9 = naive 11+9+9=29 -> reduce ace to 1 -> 1+9+9=19, hard.
    const v = handValue([0, 8, 21]);
    expect(v.total).toBe(19);
    expect(v.soft).toBe(false);
  });
});

describe("isBust / isNaturalBlackjack", () => {
  it("busts past 21", () => {
    expect(isBust([9, 22, 35])).toBe(true); // 10+10+10=30
    expect(isBust([9, 22])).toBe(false); // 20
  });

  it("a natural blackjack is exactly 2 cards totaling 21", () => {
    expect(isNaturalBlackjack([0, 9])).toBe(true); // Ace + 10
    expect(isNaturalBlackjack([0, 8, 1])).toBe(false); // 3-card 21 is NOT a natural
  });
});

describe("dealerShouldHit", () => {
  it("hits below 17", () => {
    expect(dealerShouldHit([1, 2])).toBe(true); // 2+3=5
  });

  it("stands on hard 17 and above", () => {
    expect(dealerShouldHit([9, 6])).toBe(false); // 10+7=17
    expect(dealerShouldHit([9, 22])).toBe(false); // 20
  });

  it("stands on SOFT 17 too (the 'stand on all 17s' rule this engine uses)", () => {
    expect(dealerShouldHit([0, 5])).toBe(false); // Ace+6 = 17 soft
  });
});

describe("evaluateHand", () => {
  it("player bust is a loss regardless of the dealer's hand", () => {
    const r = evaluateHand([9, 22, 35], [1, 1]);
    expect(r.outcome).toBe("dealer_win");
    expect(r.multiplier).toBe(0);
  });

  it("a natural blackjack against a non-blackjack pays the 3:2 tier (2.5x)", () => {
    const r = evaluateHand([0, 9], [1, 2]); // player 21 (2 cards), dealer 5
    expect(r.outcome).toBe("player_blackjack");
    expect(r.multiplier).toBe(2.5);
  });

  it("blackjack vs blackjack is a push", () => {
    const r = evaluateHand([0, 9], [13, 22]); // both Ace+10 naturals
    expect(r.outcome).toBe("push");
    expect(r.multiplier).toBe(1);
  });

  it("a non-natural 21 does NOT get the blackjack bonus even against a lower dealer total", () => {
    const r = evaluateHand([0, 3, 5], [9, 6]); // player Ace+4+6=21 via 3 cards, dealer 17
    expect(r.outcome).toBe("player_win");
    expect(r.multiplier).toBe(2); // plain 1:1, not 3:2
  });

  it("dealer bust pays 1:1 when the player didn't also bust", () => {
    const r = evaluateHand([1, 2], [9, 22, 35]); // player 5, dealer 30 (bust)
    expect(r.outcome).toBe("player_win");
    expect(r.multiplier).toBe(2);
  });

  it("higher total wins 1:1 when neither busts nor has a natural", () => {
    expect(evaluateHand([9, 8], [6, 6]).outcome).toBe("player_win"); // 19 vs 14
    expect(evaluateHand([6, 6], [9, 8]).outcome).toBe("dealer_win"); // 14 vs 19
  });

  it("equal totals push", () => {
    const r = evaluateHand([9, 7], [22, 20]); // both 18
    expect(r.outcome).toBe("push");
    expect(r.multiplier).toBe(1);
  });
});

describe("provably-fair dealing (deterministic fixtures)", () => {
  // ("bj-seed-1","bj-client-1",0) -> player=[J,10]=20, dealer=[8,A]=19 (soft),
  // cursor=4 after the initial deal. Dealer's 19 already >=17 -> stands
  // immediately, no extra card needed.
  it("dealInitial is deterministic and produces no duplicate cards", () => {
    const { playerCards, dealerCards, cursor } = dealInitial("bj-seed-1", "bj-client-1", 0);
    expect(playerCards).toEqual([23, 35]);
    expect(dealerCards).toEqual([7, 26]);
    expect(cursor).toBe(4);
    const all = [...playerCards, ...dealerCards];
    expect(new Set(all).size).toBe(all.length);
  });

  it("playDealer stands immediately when the initial dealer hand is already >=17", () => {
    const { playerCards, dealerCards, cursor } = dealInitial("bj-seed-1", "bj-client-1", 0);
    const result = playDealer("bj-seed-1", "bj-client-1", 0, dealerCards, playerCards, cursor);
    expect(result.cards).toEqual(dealerCards); // untouched — no hit was needed
    expect(handValue(result.cards).total).toBe(19);
  });

  it("drawCard never returns a card already in the used set", () => {
    const used = new Set<number>([7, 26, 23, 35]);
    const { card } = drawCard("bj-seed-1", "bj-client-1", 0, used, 4);
    expect(used.has(card)).toBe(false);
    expect(card).toBeGreaterThanOrEqual(0);
    expect(card).toBeLessThanOrEqual(51);
  });

  it("a natural blackjack fixture deals exactly 21 on 2 cards", () => {
    // ("bj-search-1","bj-search-c-1",0) -> player=[J,A]=21 (natural), dealer=[6,7]=13 (no BJ).
    const { playerCards, dealerCards } = dealInitial("bj-search-1", "bj-search-c-1", 0);
    expect(isNaturalBlackjack(playerCards)).toBe(true);
    expect(isNaturalBlackjack(dealerCards)).toBe(false);
  });
});
