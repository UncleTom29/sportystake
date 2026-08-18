import { describe, it, expect } from "vitest";
import { resolveDice } from "./casino";

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
