import fs from "fs";
import path from "path";
import type { DailyEntry, PicksResult, RolloverState } from "./types";

const PICKS_DIR = path.join(__dirname, "picks");

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export function printPicks(result: PicksResult, state: RolloverState, stakeUnits: number): void {
  console.log("");
  console.log(bold(`=== Rollover Bot — Day ${state.day} ===`));
  console.log("");

  if (result.verdict === "SKIP") {
    console.log(yellow("No bet today."));
    console.log(dim(result.skipReason ?? ""));
    console.log("");
    return;
  }

  for (const [i, s] of result.selections.entries()) {
    const tag = s.source === "app" ? green("[verified vs scraped odds]") : yellow("[web-sourced — verify before placing]");
    console.log(`${bold(`Selection ${i + 1}`)}  ${s.match}  ${dim(`(${s.leagueName} · ${s.sport})`)}  ${tag}`);
    console.log(`  Pick: ${green(s.label)}  @ ${s.oddsDecimal.toFixed(2)}  [${s.marketType}]`);
    console.log(`  Kickoff: ${s.startTime}`);
    console.log(`  ${dim(s.reasoning)}`);
    if (s.source === "app") {
      console.log(`  marketId: ${dim(s.marketId ?? "")}  outcome: ${dim(String(s.outcome))}`);
    } else {
      console.log(`  bookmaker: ${dim(s.bookmaker ?? "unspecified")}`);
    }
    console.log("");
  }

  console.log(bold(`Combined odds: ${result.combinedOdds.toFixed(2)}`));
  console.log(`Stake: ${stakeUnits.toFixed(2)} units  →  Potential return: ${(stakeUnits * result.combinedOdds).toFixed(2)} units`);
  console.log("");
  console.log(dim(result.summary));
  console.log("");
}

export function printState(state: RolloverState): void {
  console.log("");
  console.log(bold("=== Rollover Status ==="));
  console.log(`Status: ${state.status}`);
  if (state.status !== "idle") {
    console.log(`Day: ${state.day}/10`);
    console.log(`Bankroll: ${state.bankrollUnits.toFixed(2)} units`);
  }
  if (state.history.length > 0) {
    console.log("");
    console.log(bold("History:"));
    for (const h of state.history) {
      console.log(
        `  ${h.date}  day ${h.day}  ${h.status.padEnd(8)}  ${h.selections.length} pick(s)  combined=${h.combinedOdds.toFixed(2)}`,
      );
    }
  }
  console.log("");
}

export function writePicksFile(result: PicksResult, state: RolloverState): void {
  fs.mkdirSync(PICKS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(PICKS_DIR, `${date}.json`);
  const mdPath = path.join(PICKS_DIR, `${date}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ date, day: state.day, result }, null, 2));

  const lines: string[] = [`# Rollover Bot — ${date} (Day ${state.day})`, ""];
  if (result.verdict === "SKIP") {
    lines.push("**No bet today.**", "", result.skipReason ?? "");
  } else {
    for (const [i, s] of result.selections.entries()) {
      lines.push(
        `## Selection ${i + 1}: ${s.match}`,
        `- Source: ${s.source === "app" ? "verified vs scraped odds" : `**web-sourced (${s.bookmaker}) — verify before placing**`}`,
        `- League: ${s.leagueName} (${s.sport})`,
        `- Pick: **${s.label}** @ ${s.oddsDecimal.toFixed(2)} (${s.marketType})`,
        `- Kickoff: ${s.startTime}`,
        `- Reasoning: ${s.reasoning}`,
        s.source === "app" ? `- marketId: \`${s.marketId}\` outcome: \`${s.outcome}\`` : `- bookmaker: ${s.bookmaker}`,
        "",
      );
    }
    lines.push(`**Combined odds: ${result.combinedOdds.toFixed(2)}**`, "", result.summary);
  }
  fs.writeFileSync(mdPath, lines.join("\n"));
  console.log(dim(`Saved: ${mdPath}`));
}

export function printResolveSummary(entry: DailyEntry, state: RolloverState): void {
  console.log("");
  if (entry.status === "won" && state.status === "completed") {
    console.log(green(bold("🎉 10-day rollover COMPLETE! Final bankroll: " + state.bankrollUnits.toFixed(2) + " units")));
  } else if (entry.status === "won") {
    console.log(green(`Day ${entry.day} won. Advancing to day ${state.day}. Bankroll: ${state.bankrollUnits.toFixed(2)} units.`));
  } else if (entry.status === "lost") {
    console.log(yellow(`Day ${entry.day} lost. Rollover reset — run "pick" again to start a new run.`));
  }
  console.log("");
}
