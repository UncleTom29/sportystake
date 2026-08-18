import { describe, it, expect } from "vitest";
import { onchainCrashMultiplierX100, flightDurationMs, BPS_DENOM, MAX_AUTOCASHOUT_X100 } from "./crashMath";

describe("onchainCrashMultiplierX100", () => {
  // Real production data: CrashGame round 578, rtpBps=9000. The contract
  // resolved this round at 1.02x on-chain — the previous (buggy) version of
  // this function, which hardcoded a 99%-RTP-shaped formula regardless of
  // the contract's actual live rtpBps, predicted 1.13x for these same
  // inputs instead. A player's cashout landed in that gap: they saw the
  // flight animation (timed off the wrong 1.13x prediction) still climbing,
  // submitted a cashout, and it reverted because the real on-chain round —
  // correctly resolved at 1.02x — had already ended. This test pins the fix.
  it("reproduces the real on-chain result for round 578 (rtpBps=9000)", () => {
    const seed = "0xbdb4cac935ce5e99542ffb0097d17bb04c75d6d05b736fb39fcd181526cfb03b" as `0x${string}`;
    const result = onchainCrashMultiplierX100(seed, 578n, 9000n);
    expect(result).toBe(102); // 1.02x — matches CrashGame.rounds(578).crashMultiplierX100 exactly
  });

  it("would have produced the old (wrong) 1.13x under the pre-fix hardcoded-99%-RTP shape", () => {
    // Demonstrates the actual size of the bug this fixes — not a case this
    // function should ever reproduce again, kept as a negative-contrast
    // check so a future regression back to a hardcoded RTP is caught even
    // if someone "fixes" this test's expected value instead of the code.
    const seed = "0xbdb4cac935ce5e99542ffb0097d17bb04c75d6d05b736fb39fcd181526cfb03b" as `0x${string}`;
    const buggyRtpBps = 9900n; // the old implicit hardcoded assumption
    const result = onchainCrashMultiplierX100(seed, 578n, buggyRtpBps);
    expect(result).toBe(113);
    expect(result).not.toBe(102);
  });

  it("is a pure function of (seed, roundId, rtpBps) — same inputs, same output", () => {
    const seed = "0x" + "ab".repeat(32) as `0x${string}`;
    const a = onchainCrashMultiplierX100(seed, 42n, 9000n);
    const b = onchainCrashMultiplierX100(seed, 42n, 9000n);
    expect(a).toBe(b);
  });

  it("changing rtpBps changes the result for a fixed seed/round", () => {
    const seed = "0x" + "cd".repeat(32) as `0x${string}`;
    const at9000 = onchainCrashMultiplierX100(seed, 1n, 9000n);
    const at9900 = onchainCrashMultiplierX100(seed, 1n, 9900n);
    expect(at9000).not.toBe(at9900);
  });

  it("never returns below the 101 floor except the exact 100 instant-bust value", () => {
    for (let roundId = 0n; roundId < 500n; roundId++) {
      const seed = ("0x" + roundId.toString(16).padStart(64, "0")) as `0x${string}`;
      const result = onchainCrashMultiplierX100(seed, roundId, 9000n);
      expect(result === 100 || result >= 101).toBe(true);
    }
  });

  it("never exceeds MAX_AUTOCASHOUT_X100", () => {
    for (let roundId = 0n; roundId < 500n; roundId++) {
      const seed = ("0x" + roundId.toString(16).padStart(64, "0")) as `0x${string}`;
      const result = onchainCrashMultiplierX100(seed, roundId, 9000n);
      expect(result).toBeLessThanOrEqual(Number(MAX_AUTOCASHOUT_X100));
    }
  });

  it("BPS_DENOM matches CrashGame.sol's constant", () => {
    expect(BPS_DENOM).toBe(10_000n);
  });
});

describe("flightDurationMs", () => {
  it("is monotonically increasing with the crash multiplier", () => {
    const low = flightDurationMs(102);   // 1.02x
    const mid = flightDurationMs(200);   // 2.00x
    const high = flightDurationMs(1000); // 10.00x
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("never returns below the 500ms floor, even for the lowest possible crash", () => {
    expect(flightDurationMs(101)).toBeGreaterThanOrEqual(500);
    expect(flightDurationMs(100)).toBeGreaterThanOrEqual(500);
  });

  it("caps at the 25s ceiling for very high multipliers", () => {
    expect(flightDurationMs(100_000)).toBe(25_000);
  });
});
