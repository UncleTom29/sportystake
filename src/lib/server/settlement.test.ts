import { describe, it, expect } from "vitest";
import { resolveScoreBasedOutcome, resolveAsianHandicapBet, resolveDoubleChanceBet } from "./settlement";

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

  it("resolves any line the scraper actually offers, not just 1.5/2.5/3.5", () => {
    expect(resolveScoreBasedOutcome("over_under_5", 1, 0)).toBe(0);  // total 1 > 0.5 -> over
    expect(resolveScoreBasedOutcome("over_under_5", 0, 0)).toBe(1);  // total 0 > 0.5? no -> under
    expect(resolveScoreBasedOutcome("over_under_45", 2, 2)).toBe(1); // total 4 > 4.5? no -> under
    expect(resolveScoreBasedOutcome("over_under_45", 3, 2)).toBe(0); // total 5 > 4.5 -> over
    expect(resolveScoreBasedOutcome("over_under_65", 3, 3)).toBe(1); // total 6 > 6.5? no -> under
  });

  it("btts: both score vs at least one blank, 0=Yes 1=No", () => {
    expect(resolveScoreBasedOutcome("btts", 1, 1)).toBe(0);
    expect(resolveScoreBasedOutcome("btts", 1, 0)).toBe(1);
    expect(resolveScoreBasedOutcome("btts", 0, 0)).toBe(1);
  });

  it("returns null for asian_handicap and anything unrecognized — those need per-bet resolution, not a market-wide outcome", () => {
    expect(resolveScoreBasedOutcome("asian_handicap", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("double_chance", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("team_total_15", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("over_under_", 2, 1)).toBeNull();
    expect(resolveScoreBasedOutcome("over_under_abc", 2, 1)).toBeNull();
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

describe("resolveDoubleChanceBet", () => {
  it("1X wins on a home win or a draw, loses on an away win", () => {
    expect(resolveDoubleChanceBet("1X", 2, 1)).toBe("win");  // home win
    expect(resolveDoubleChanceBet("1X", 1, 1)).toBe("win");  // draw
    expect(resolveDoubleChanceBet("1X", 0, 2)).toBe("lose"); // away win
  });

  it("12 wins on a home or away win, loses on a draw", () => {
    expect(resolveDoubleChanceBet("12", 2, 1)).toBe("win");
    expect(resolveDoubleChanceBet("12", 0, 2)).toBe("win");
    expect(resolveDoubleChanceBet("12", 1, 1)).toBe("lose");
  });

  it("X2 wins on a draw or an away win, loses on a home win", () => {
    expect(resolveDoubleChanceBet("X2", 1, 1)).toBe("win");
    expect(resolveDoubleChanceBet("X2", 0, 2)).toBe("win");
    expect(resolveDoubleChanceBet("X2", 2, 1)).toBe("lose");
  });

  it("exactly one of the three combos loses for any given result — never zero, never two", () => {
    for (const [h, a] of [[2, 1], [1, 1], [0, 2]] as const) {
      const verdicts = (["1X", "12", "X2"] as const).map((l) => resolveDoubleChanceBet(l, h, a));
      expect(verdicts.filter((v) => v === "lose").length).toBe(1);
      expect(verdicts.filter((v) => v === "win").length).toBe(2);
    }
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveDoubleChanceBet(" 1x ", 2, 1)).toBe("win");
    expect(resolveDoubleChanceBet("x2", 1, 1)).toBe("win");
  });

  it("malformed or unrecognized labels are unsupported, not a thrown error", () => {
    expect(resolveDoubleChanceBet("Home (-1.5)", 1, 0)).toBe("unsupported");
    expect(resolveDoubleChanceBet("", 1, 0)).toBe("unsupported");
    expect(resolveDoubleChanceBet("1X2", 1, 0)).toBe("unsupported");
  });
});
