import { describe, it, expect } from "vitest";
import { resolveDice, resolveRoulette, resolveBaccarat, resolveSlots } from "./casino";

// Deterministic (serverSeed, clientSeed, nonce) -> diceRoll() fixtures,
// precomputed offline against provably-fair.ts's exact HMAC formula so
// these tests never depend on guessing which side of a target a random
// roll lands on:
//   ("seed-a","client-a",0) -> roll ~= 24.32386737782508
//   ("seed-b","client-b",0) -> roll ~= 43.48737099207938

// Effectively-unconstrained capacity for tests that aren't exercising the
// pre-hoc solvency gate itself.
const UNCONSTRAINED = 10n ** 18n;

describe("resolveDice", () => {
  it("win multiplier follows (1-edge)/chance for the given rtpBps, unremapped when capacity is sufficient", () => {
    // roll ~24.32, target=50 under -> win. chance=0.5, edge=(10000-9000)/10000=0.1
    // -> multiplier = 0.9/0.5 = 1.8
    const result = resolveDice({
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      target: 50,
      direction: "under",
      rtpBps: 9000,
      availableCapacity: UNCONSTRAINED,
    });
    expect(result.win).toBe(true);
    expect(result.payoutMultiplier).toBeCloseTo(1.8, 3);
    expect(result.payoutUsdc).toBe(180_000_000n); // 180 USDC, 6 decimals
    expect(result.detail.remapped).toBe(false);
    expect(result.detail.roll).toBeCloseTo(24.32, 1);
  });

  it("a lower rtpBps produces a proportionally lower multiplier for the identical roll and target", () => {
    const result = resolveDice({
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      target: 50,
      direction: "under",
      rtpBps: 5000, // 50% RTP -> edge=0.5, multiplier = 0.5/0.5 = 1.0 (breakeven)
      availableCapacity: UNCONSTRAINED,
    });
    expect(result.win).toBe(true);
    expect(result.payoutMultiplier).toBeCloseTo(1.0, 3);
    expect(result.payoutUsdc).toBe(100_000_000n); // exactly the stake back
  });

  it("rtpBps never influences win/lose, only payout size if won", () => {
    // roll ~43.49, target=50, direction="over" -> 43.49 > 50 is false -> loses,
    // regardless of rtpBps. A natural loss is never remapped either, since
    // there's nothing to gate — capacity only matters for natural wins.
    for (const rtpBps of [5000, 9000, 9900]) {
      const result = resolveDice({
        serverSeed: "seed-b",
        fairness: { serverSeedHash: "", clientSeed: "client-b", nonce: 0 },
        amount: "100",
        target: 50,
        direction: "over",
        rtpBps,
        availableCapacity: 0n, // thinnest possible capacity — irrelevant to a natural loss
      });
      expect(result.win).toBe(false);
      expect(result.payoutMultiplier).toBe(0);
      expect(result.payoutUsdc).toBe(0n);
      expect(result.detail.remapped).toBe(false);
    }
  });

  it("rejects a target outside [1, 98]", () => {
    const base = {
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      direction: "under" as const,
      rtpBps: 9000,
      availableCapacity: UNCONSTRAINED,
    };
    expect(() => resolveDice({ ...base, target: 0 })).toThrow();
    expect(() => resolveDice({ ...base, target: 99 })).toThrow();
  });

  describe("pre-hoc capacity gating", () => {
    it("a natural win under 'under' is remapped into the loss region [target,100) when capacity is short — displayed roll always matches the verdict", () => {
      // Natural: roll=24.32, target=50, under -> win, quoted=180, deficit=80.
      // availableCapacity=50 < 80 -> remapped. Transform:
      // target + roll*(100-target)/100 = 50 + 24.32386...*50/100 ~= 62.16.
      const result = resolveDice({
        serverSeed: "seed-a",
        fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
        amount: "100",
        target: 50,
        direction: "under",
        rtpBps: 9000,
        availableCapacity: 50_000_000n,
      });
      expect(result.detail.remapped).toBe(true);
      expect(result.win).toBe(false); // the displayed roll must itself be a loss
      expect(result.payoutUsdc).toBe(0n);
      expect(result.detail.roll as number).toBeGreaterThanOrEqual(50); // "under" loss region
      expect(result.detail.roll as number).toBeCloseTo(62.16, 1);
      // The natural roll is still disclosed for independent re-verification
      // of the remap transform itself, on top of the standard seed check.
      expect(result.detail.naturalRoll as number).toBeCloseTo(24.32, 1);
      expect(result.detail.availableCapacity).toBe("50000000");
    });

    it("a natural win under 'over' is remapped into the loss region [0,target] when capacity is short", () => {
      // Natural: roll=43.49, target=30, over -> win (43.49>30).
      // chance=(99-30)/100=0.69, multiplier=0.9/0.69, quoted~=130.43,
      // deficit~=30.43. availableCapacity=10 < deficit -> remapped.
      // Transform: roll*target/100 = 43.48737...*30/100 ~= 13.05.
      const result = resolveDice({
        serverSeed: "seed-b",
        fairness: { serverSeedHash: "", clientSeed: "client-b", nonce: 0 },
        amount: "100",
        target: 30,
        direction: "over",
        rtpBps: 9000,
        availableCapacity: 10_000_000n,
      });
      expect(result.detail.remapped).toBe(true);
      expect(result.win).toBe(false);
      expect(result.payoutUsdc).toBe(0n);
      expect(result.detail.roll as number).toBeLessThanOrEqual(30); // "over" loss region
      expect(result.detail.roll as number).toBeCloseTo(13.05, 1);
    });

    it("capacity exactly equal to the deficit does NOT trigger a remap — the gate is strict (>), matching what the pool can genuinely still afford", () => {
      const result = resolveDice({
        serverSeed: "seed-a",
        fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
        amount: "100",
        target: 50,
        direction: "under",
        rtpBps: 9000,
        availableCapacity: 80_000_000n, // == deficit exactly
      });
      expect(result.detail.remapped).toBe(false);
      expect(result.win).toBe(true);
      expect(result.payoutUsdc).toBe(180_000_000n);
      expect(result.detail.roll as number).toBeCloseTo(24.32, 1);
    });
  });
});

describe("resolveRoulette", () => {
  // ("r-seed-1","r-client-1",0) -> number = 6 (black, even, low)

  it("straight-up win remaps to the very next number when the 36x payout is unaffordable", () => {
    const result = resolveRoulette({
      serverSeed: "r-seed-1",
      fairness: { serverSeedHash: "", clientSeed: "r-client-1", nonce: 0 },
      amount: "10",
      bet: { type: "straight", selection: 6 },
      availableCapacity: 100_000_000n, // 100 USDC, deficit is 350 USDC (10 * 35)
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.win).toBe(false);
    expect(result.payoutUsdc).toBe(0n);
    expect(result.detail.number).toBe(7); // next number after 6, which already loses a straight-on-6 bet
    expect(result.detail.naturalNumber).toBe(6);
  });

  it("a color bet remaps to the nearest number of the OTHER color when unaffordable", () => {
    const result = resolveRoulette({
      serverSeed: "r-seed-1",
      fairness: { serverSeedHash: "", clientSeed: "r-client-1", nonce: 0 },
      amount: "1000",
      bet: { type: "black" }, // 6 is black -> natural win
      availableCapacity: 500_000_000n, // 500 USDC, deficit is 1000 USDC
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.win).toBe(false);
    expect(result.detail.number).toBe(7);
    expect(result.detail.color).toBe("red");
  });

  it("no remap when capacity is sufficient — pays the full natural result", () => {
    const result = resolveRoulette({
      serverSeed: "r-seed-1",
      fairness: { serverSeedHash: "", clientSeed: "r-client-1", nonce: 0 },
      amount: "10",
      bet: { type: "straight", selection: 6 },
      availableCapacity: 1_000_000_000n, // 1000 USDC, comfortably above the 350 deficit
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(true);
    expect(result.detail.number).toBe(6);
    expect(result.payoutUsdc).toBe(360_000_000n); // 10 * 36
  });

  it("a natural loss is never remapped, regardless of capacity", () => {
    const result = resolveRoulette({
      serverSeed: "r-seed-1",
      fairness: { serverSeedHash: "", clientSeed: "r-client-1", nonce: 0 },
      amount: "10",
      bet: { type: "straight", selection: 5 }, // number is 6, not 5 -> natural loss
      availableCapacity: 0n,
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(false);
    expect(result.detail.number).toBe(6); // untouched
  });
});

describe("resolveBaccarat", () => {
  // ("bc-seed-3","bc-client-3",0) -> p=3, b=2, winner=player
  // ("bc-tie-seed-11","bc-tie-client-11",0) -> p=9, b=9, winner=tie

  it("a player win remaps to the nearest (p,b) pair with a different winner when unaffordable", () => {
    const result = resolveBaccarat({
      serverSeed: "bc-seed-3",
      fairness: { serverSeedHash: "", clientSeed: "bc-client-3", nonce: 0 },
      amount: "10",
      bet: "player",
      availableCapacity: 0n, // deficit is 10 USDC (2x - 1x on a 10 stake)
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.win).toBe(false);
    expect(result.payoutUsdc).toBe(0n);
    expect(result.detail.winner).not.toBe("player");
    expect(result.detail.naturalPlayer).toBe(3);
    expect(result.detail.naturalBanker).toBe(2);
  });

  it("a tie win (9x) remaps correctly even when the very next combined index is still a tie", () => {
    // naturalIdx = 9*10+9 = 99. idx+1=0 -> (0,0), STILL a tie (0===0) -> keep
    // walking. idx+2=1 -> (0,1), banker wins -> first genuine loss for "tie".
    const result = resolveBaccarat({
      serverSeed: "bc-tie-seed-11",
      fairness: { serverSeedHash: "", clientSeed: "bc-tie-client-11", nonce: 0 },
      amount: "10",
      bet: "tie",
      availableCapacity: 10_000_000n, // 10 USDC, deficit is 80 USDC (9x-1x on a 10 stake)
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.win).toBe(false);
    expect(result.detail.player).toBe(0);
    expect(result.detail.banker).toBe(1);
    expect(result.detail.winner).toBe("banker");
    expect(result.detail.naturalPlayer).toBe(9);
    expect(result.detail.naturalBanker).toBe(9);
  });

  it("no remap when capacity is sufficient", () => {
    const result = resolveBaccarat({
      serverSeed: "bc-seed-3",
      fairness: { serverSeedHash: "", clientSeed: "bc-client-3", nonce: 0 },
      amount: "10",
      bet: "player",
      availableCapacity: 20_000_000n, // 20 USDC, above the 10 USDC deficit
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(true);
    expect(result.payoutUsdc).toBe(20_000_000n);
    expect(result.detail.player).toBe(3);
    expect(result.detail.banker).toBe(2);
  });

  it("a natural loss (bet doesn't match the natural winner) is never remapped", () => {
    const result = resolveBaccarat({
      serverSeed: "bc-seed-3",
      fairness: { serverSeedHash: "", clientSeed: "bc-client-3", nonce: 0 },
      amount: "10",
      bet: "banker", // natural winner is player -> natural loss
      availableCapacity: 0n,
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(false);
    expect(result.detail.player).toBe(3);
    expect(result.detail.banker).toBe(2);
  });
});

describe("resolveSlots", () => {
  // ("slot-seed-10","slot-client-10",0) -> row0=[cherry,cherry,cherry,star,cherry]
  // (3 matches, mult=6), row1=[lemon,cherry,cherry,lemon,cherry] (no match
  // beyond position 0, mult=0), row2=[star,cherry,cherry,bell,bell] (mult=0).
  // Only row0 wins naturally.
  //
  // ("slot-multi-156","slot-multi-c-156",0) -> row0 mult=6 (3 matches),
  // row1=[cherry,cherry,cherry,cherry,lemon] (4 matches, mult=8), row2 mult=0.
  // Both row0 and row1 win naturally.

  it("no remap when capacity comfortably covers the single natural win", () => {
    const result = resolveSlots({
      serverSeed: "slot-seed-10",
      fairness: { serverSeedHash: "", clientSeed: "slot-client-10", nonce: 0 },
      amount: "9",
      lines: 3,
      availableCapacity: 20_000_000n, // deficit is 9 USDC (perLine=3 * 6 - amt=9)
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(true);
    expect(result.payoutMultiplier).toBe(6);
    expect(result.payoutUsdc).toBe(18_000_000n); // perLine(3) * 6
    expect(result.detail.winLines).toEqual([0]);
    expect((result.detail.reels as number[][])[0]).toEqual([0, 0, 0, 2, 0]);
  });

  it("remaps the single winning row to a guaranteed loss when its deficit is unaffordable — displayed reels always match the verdict", () => {
    const result = resolveSlots({
      serverSeed: "slot-seed-10",
      fairness: { serverSeedHash: "", clientSeed: "slot-client-10", nonce: 0 },
      amount: "9",
      lines: 3,
      availableCapacity: 5_000_000n, // 5 USDC, short of the 9 USDC deficit
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.win).toBe(false);
    expect(result.payoutUsdc).toBe(0n);
    expect(result.detail.winLines).toEqual([]);
    const reels = result.detail.reels as number[][];
    expect(reels[0]).toEqual([0, 0, 1, 2, 0]); // position 2 forced off cherry
    const remappedRows = result.detail.remappedRows as Record<number, number[]>;
    expect(remappedRows[0]).toEqual([0, 0, 0, 2, 0]); // natural row disclosed for re-verification
  });

  it("confirms rows left-to-right against a running spin-wide budget — both natural wins fit when capacity allows", () => {
    const result = resolveSlots({
      serverSeed: "slot-multi-156",
      fairness: { serverSeedHash: "", clientSeed: "slot-multi-c-156", nonce: 0 },
      amount: "9",
      lines: 3,
      availableCapacity: 40_000_000n, // covers the combined deficit of 33 USDC (perLine=3*14 - 9)
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.payoutMultiplier).toBe(14); // 6 (row0) + 8 (row1)
    expect(result.payoutUsdc).toBe(42_000_000n); // perLine(3) * 14
    expect(result.detail.winLines).toEqual([0, 1]);
  });

  it("confirms the first row that fits and remaps only the row that pushes the running total over capacity — NOT an all-or-nothing veto of the whole spin", () => {
    const result = resolveSlots({
      serverSeed: "slot-multi-156",
      fairness: { serverSeedHash: "", clientSeed: "slot-multi-c-156", nonce: 0 },
      amount: "9",
      lines: 3,
      // Covers row0 alone (9 USDC deficit) but not row0+row1 together (33).
      availableCapacity: 20_000_000n,
    });
    expect(result.detail.remapped).toBe(true);
    expect(result.payoutMultiplier).toBe(6); // row0 only
    expect(result.payoutUsdc).toBe(18_000_000n);
    expect(result.detail.winLines).toEqual([0]); // row1 excluded, remapped to a loss
    const remappedRows = result.detail.remappedRows as Record<number, number[]>;
    expect(Object.keys(remappedRows)).toEqual(["1"]);
    expect(remappedRows[1]).toEqual([0, 0, 0, 0, 1]); // row1's natural (4-match) draw
  });

  it("rows beyond the played line count are still drawn and shown, but never evaluated for wins or gated by capacity", () => {
    const result = resolveSlots({
      serverSeed: "slot-seed-10",
      fairness: { serverSeedHash: "", clientSeed: "slot-client-10", nonce: 0 },
      amount: "9",
      lines: 1, // only row 0 is scored — perLine is the FULL stake (9 USDC)
      // here, not amt/3, so row0's deficit is 9*6-9=45 USDC — needs more
      // capacity than the lines=3 tests above to stay unremapped.
      availableCapacity: 100_000_000n,
    });
    const reels = result.detail.reels as number[][];
    expect(reels.length).toBe(3); // all 3 rows still shown
    expect(reels[0]).toEqual([0, 0, 0, 2, 0]);
    expect(reels[1]).toEqual([1, 0, 0, 1, 0]); // drawn, unevaluated
    expect(reels[2]).toEqual([2, 0, 0, 4, 4]); // drawn, unevaluated
    expect(result.detail.winLines).toEqual([0]);
  });

  it("a spin with no natural wins anywhere is never remapped and pays nothing, regardless of capacity", () => {
    // ("slot-nowin-2","slot-nowin-c-2",0) -> all 3 rows fail to reach 3
    // matches (max run lengths of 1 each) — nothing for the gate to do.
    const result = resolveSlots({
      serverSeed: "slot-nowin-2",
      fairness: { serverSeedHash: "", clientSeed: "slot-nowin-c-2", nonce: 0 },
      amount: "9",
      lines: 3,
      availableCapacity: 0n, // thinnest possible capacity — irrelevant here
    });
    expect(result.detail.remapped).toBe(false);
    expect(result.win).toBe(false);
    expect(result.payoutUsdc).toBe(0n);
    expect(result.detail.winLines).toEqual([]);
    const reels = result.detail.reels as number[][];
    expect(reels).toEqual([
      [1, 0, 0, 1, 0],
      [0, 4, 0, 1, 1],
      [0, 1, 0, 4, 1],
    ]);
  });
});
