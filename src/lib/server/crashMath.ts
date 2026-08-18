/**
 * Pure crash-round math shared by crash-scheduler.worker.ts. Kept separate
 * from the worker file (which has a side-effecting top-level `bootstrap()`
 * call, unsafe to import in a test) so it's independently testable — see
 * settlement.ts/casino.ts/blackjackEngine.ts for the same split elsewhere
 * in this codebase.
 */
import { keccak256, encodePacked } from "viem";

export const BPS_DENOM = 10_000n;
/** Mirrors CrashGame.sol's MAX_AUTOCASHOUT_X100 constant exactly. */
export const MAX_AUTOCASHOUT_X100 = 100_000n;
/** Mirrors CrashGame.sol's NO_RISK_FLOOR_X100 constant exactly. */
export const NO_RISK_FLOOR_X100 = 1_000n;

/**
 * Mirrors CrashGame.sol's `_crashFromSeed` exactly — keccak256-based, NOT
 * the HMAC formula in provably-fair.ts, which is for the off-chain casino
 * games.
 *
 * `rtpBps` is a live parameter, not a constant, because it's exactly that on
 * the contract side too (admin-adjustable via setRtp). This function used
 * to hardcode the old fixed-1%-edge shape (`r % 100n`, literal `99n`) from
 * before the Phase 0 RTP-unification generalized the contract's own formula
 * to read `rtpBps` dynamically — a real, live divergence once the contract
 * moved to rtpBps=9000 (10% edge) while this stayed pinned to the old
 * implicit 9900 (1% edge). Confirmed against real production data: for
 * round 578 (seed 0xbdb4..., rtpBps=9000), the contract resolved at 1.02x
 * on-chain while the old formula here predicted — and timed the flight
 * animation, and published as the result — 1.13x. A player who tried to
 * cash out into that gap got a reverted transaction (the real round had
 * already resolved) and saw a displayed result that never matched what
 * actually happened on-chain.
 *
 * The worker no longer trusts this function's output as the final result
 * either way (see crash-scheduler.worker.ts's `decodeResolvedCrash`, which
 * reads the contract's own `RoundResolved` event instead) — this is now
 * used only to time the flight animation, so any future divergence between
 * this and the Solidity source can only cause a pacing mismatch, not a
 * wrong displayed outcome.
 *
 * `noRisk` mirrors the contract's own branch in `_crashFromSeed`: true only
 * when nobody joined the round, in which case it draws uniformly from
 * [NO_RISK_FLOOR_X100, MAX_AUTOCASHOUT_X100] (10x-1000x) instead of the
 * normal curve, so the public round history stays visually rich through a
 * lull with no players. Kept in lockstep with the Solidity side deliberately
 * — this exact kind of two-copies-of-one-formula drift is what caused the
 * bug documented above in the first place.
 */
export function onchainCrashMultiplierX100(seed: `0x${string}`, roundId: bigint, rtpBps: bigint, noRisk: boolean): number {
  const mix = keccak256(encodePacked(["bytes32", "uint256"], [seed, roundId]));
  const r = BigInt(mix);
  if (noRisk) {
    const span = MAX_AUTOCASHOUT_X100 - NO_RISK_FLOOR_X100 + 1n;
    return Number(NO_RISK_FLOOR_X100 + (r % span));
  }
  if (r % BPS_DENOM < (BPS_DENOM - rtpBps)) return 100;
  const e = r % 1_000_000n;
  let crashX100 = (rtpBps * 1_000_000n) / (100n * (1_000_000n - e));
  if (crashX100 < 101n) crashX100 = 101n;
  if (crashX100 > MAX_AUTOCASHOUT_X100) crashX100 = MAX_AUTOCASHOUT_X100;
  return Number(crashX100);
}

const GROWTH_RATE = 0.07; // matches the client's animation curve (100 * e^(rate*t))
const MAX_FLIGHT_MS = 25_000; // hard cap so a huge multiplier can't stall the round loop

/** How long (ms) the flight animation should run to reach `crashX100` at the client's own growth curve. */
export function flightDurationMs(crashX100: number): number {
  const ratio = crashX100 / 100;
  const seconds = Math.log(ratio) / GROWTH_RATE;
  return Math.min(MAX_FLIGHT_MS, Math.max(500, Math.round(seconds * 1000)));
}
