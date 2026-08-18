import { describe, it, expect } from "vitest";
import { resolveDice } from "./casino";

// Deterministic (serverSeed, clientSeed, nonce) -> diceRoll() fixtures,
// precomputed offline against provably-fair.ts's exact HMAC formula so
// these tests never depend on guessing which side of a target a random
// roll lands on:
//   ("seed-a","client-a",0) -> roll ~= 24.32
//   ("seed-b","client-b",0) -> roll ~= 43.49

describe("resolveDice", () => {
  it("win multiplier follows (1-edge)/chance for the given rtpBps", () => {
    // roll ~24.32, target=50 under -> win. chance=0.5, edge=(10000-9000)/10000=0.1
    // -> multiplier = 0.9/0.5 = 1.8
    const result = resolveDice({
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      target: 50,
      direction: "under",
      rtpBps: 9000,
    });
    expect(result.win).toBe(true);
    expect(result.payoutMultiplier).toBeCloseTo(1.8, 3);
    expect(result.payoutUsdc).toBe(180_000_000n); // 180 USDC, 6 decimals
  });

  it("a lower rtpBps produces a proportionally lower multiplier for the identical roll and target", () => {
    const result = resolveDice({
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      target: 50,
      direction: "under",
      rtpBps: 5000, // 50% RTP -> edge=0.5, multiplier = 0.5/0.5 = 1.0 (breakeven)
    });
    expect(result.win).toBe(true);
    expect(result.payoutMultiplier).toBeCloseTo(1.0, 3);
    expect(result.payoutUsdc).toBe(100_000_000n); // exactly the stake back
  });

  it("rtpBps never influences win/lose, only payout size if won", () => {
    // roll ~43.49, target=50, direction="over" -> 43.49 > 50 is false -> loses,
    // regardless of rtpBps.
    for (const rtpBps of [5000, 9000, 9900]) {
      const result = resolveDice({
        serverSeed: "seed-b",
        fairness: { serverSeedHash: "", clientSeed: "client-b", nonce: 0 },
        amount: "100",
        target: 50,
        direction: "over",
        rtpBps,
      });
      expect(result.win).toBe(false);
      expect(result.payoutMultiplier).toBe(0);
      expect(result.payoutUsdc).toBe(0n);
    }
  });

  it("rejects a target outside [1, 98]", () => {
    const base = {
      serverSeed: "seed-a",
      fairness: { serverSeedHash: "", clientSeed: "client-a", nonce: 0 },
      amount: "100",
      direction: "under" as const,
      rtpBps: 9000,
    };
    expect(() => resolveDice({ ...base, target: 0 })).toThrow();
    expect(() => resolveDice({ ...base, target: 99 })).toThrow();
  });
});
