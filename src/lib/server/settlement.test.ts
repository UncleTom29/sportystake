import { describe, it, expect } from "vitest";
import { resolveScoreBasedOutcome, resolveAsianHandicapBet } from "./settlement";

describe("resolveScoreBasedOutcome", () => {
  it("1X2: home win, draw, away win", () => {
    expect(resolveScoreBasedOutcome("1X2", 2, 1)).toBe(0);
    expect(resolveScoreBasedOutcome("1X2", 1, 1)).toBe(1);
    expect(resolveScoreBasedOutcome("1X2", 0, 2)).toBe(2);
  });

  it("over_under_25: total strictly above/below the line, 0=Over 1=Under", () => {
    expect(resolveScoreBasedOutcome("over_under_25", 2, 1)).toBe(0); // 3 > 2.5
    expect(resolveScoreBasedOutcome("over_under_25", 1, 0)).toBe(1); // 1 < 2.5
    expect(resolveScoreBasedOutcome("over_under_25", 0, 0)).toBe(1); // 0 < 2.5
  });

  it("over_under_15 and over_under_35 use their own line", () => {
    expect(resolveScoreBasedOutcome("over_under_15", 1, 0)).toBe(1); // 1 > 1.5? no -> under
    expect(resolveScoreBasedOutcome("over_under_15", 1, 1)).toBe(0); // 2 > 1.5 -> over
    expect(resolveScoreBasedOutcome("over_under_35", 2, 1)).toBe(1); // 3 < 3.5 -> under
    expect(resolveScoreBasedOutcome("over_under_35", 2, 2)).toBe(0); // 4 > 3.5 -> over
  });

  it("btts: both score vs at least one blank, 0=Yes 1=No", () => {
    expect(resolveScoreBasedOutcome("btts", 1, 1)).toBe(0);
    expect(resolveScoreBasedOutcome("btts", 1, 0)).toBe(1);
    expect(resolveScoreBasedOutcome("btts", 0, 0)).toBe(1);
  });

  it("returns null for asian_handicap and anything unrecognized — those need per-bet resolution, not a market-wide outcome", () => {
    expect(resolveScoreBasedOutcome("asian_handicap", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("double_chance", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("half_time_result", 2, 1)).toBeNull();
  });
});

describe("resolveAsianHandicapBet", () => {
  it("half-line: home side wins when home covers the line", () => {
    // Home (-1.5): home must win by 2+.
    expect(resolveAsianHandicapBet("Home (-1.5)", 2, 0)).toBe("win"); // margin 2, adjusted +0.5
    expect(resolveAsianHandicapBet("Home (-1.5)", 1, 0)).toBe("lose"); // margin 1, adjusted -0.5
  });

  it("half-line: away side is the mirror of the home side", () => {
    expect(resolveAsianHandicapBet("Away (-1.5)", 2, 0)).toBe("lose");
    expect(resolveAsianHandicapBet("Away (-1.5)", 1, 0)).toBe("win");
  });

  it("half-lines never push — margin+line can never land on exactly 0", () => {
    expect(resolveAsianHandicapBet("Home (-0.5)", 1, 1)).toBe("lose"); // 0 - 0.5 = -0.5
    expect(resolveAsianHandicapBet("Away (-0.5)", 1, 1)).toBe("win");
  });

  it("whole-number line: pushes when the adjusted margin is exactly zero", () => {
    expect(resolveAsianHandicapBet("Home (-1)", 1, 0)).toBe("push"); // margin 1 - 1 = 0
    expect(resolveAsianHandicapBet("Away (-1)", 1, 0)).toBe("push");
    expect(resolveAsianHandicapBet("Home (-1)", 2, 0)).toBe("win"); // margin 2 - 1 = 1
    expect(resolveAsianHandicapBet("Home (0)", 1, 1)).toBe("push"); // pick'em draw
  });

  it("quarter lines are reported unsupported rather than approximated", () => {
    expect(resolveAsianHandicapBet("Home (-0.25)", 1, 0)).toBe("unsupported");
    expect(resolveAsianHandicapBet("Away (1.75)", 0, 1)).toBe("unsupported");
  });

  it("malformed or unrecognized labels are unsupported, not a thrown error", () => {
    expect(resolveAsianHandicapBet("Yes", 1, 0)).toBe("unsupported");
    expect(resolveAsianHandicapBet("", 1, 0)).toBe("unsupported");
    expect(resolveAsianHandicapBet("Home (abc)", 1, 0)).toBe("unsupported");
  });
});
