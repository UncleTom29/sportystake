/**
 * SportyStake Rollover Bot — standalone LLM picks engine (decision support only,
 * never places bets; you execute manually).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/rollover-bot/run.ts pick [--stake=<units>] [--window=<hours>]
 *   npx tsx --env-file=.env scripts/rollover-bot/run.ts resolve <win|loss>
 *   npx tsx --env-file=.env scripts/rollover-bot/run.ts status
 *
 * Or via package.json: npm run rollover-bot / rollover-bot:resolve / rollover-bot:status
 *
 * Requires OPENROUTER_API_KEY in .env. Uses this repo's own scraped odds
 * (Prisma DB) plus free public sports data (ESPN, TheSportsDB) as context,
 * then a two-stage OpenRouter LLM pipeline (gather intel -> decide picks) to
 * select exactly 2 selections/day for a 10-cumulative-winning-day rollover,
 * or explicitly recommend skipping the day.
 */
import fs from "fs";
try {
  if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch {}

import { fetchCandidateMarkets } from "./dataSources/appOdds";
import { fetchRelevantNews } from "./dataSources/espn";
import { fetchRecentForm } from "./dataSources/theSportsDb";
import { gatherIntel } from "./llm/gatherIntel";
import { selectPicks } from "./llm/selectPicks";
import { loadState, saveState } from "./state";
import { printPicks, printResolveSummary, printState, writePicksFile } from "./output";
import type { DailyEntry } from "./types";

function parseFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function cmdPick(args: string[]) {
  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);

  const pending = state.history.find((h) => h.status === "pending");
  if (pending) {
    console.log(`Day ${pending.day} (${pending.date}) is still pending. Resolve it first:`);
    console.log(`  npm run rollover-bot:resolve win|loss`);
    return;
  }

  const alreadyToday = state.history.find((h) => h.date === today && h.status !== "pending");
  if (alreadyToday) {
    console.log(`Already generated a pick for today (${today}), status=${alreadyToday.status}.`);
    return;
  }

  const windowHours = Number(parseFlag(args, "window") ?? 36);
  const stakeUnits = Number(parseFlag(args, "stake") ?? (state.status === "active" ? state.bankrollUnits : state.baseStakeUnits));

  console.log(`Fetching open markets (next ${windowHours}h)...`);
  const candidates = await fetchCandidateMarkets(windowHours);
  if (candidates.length === 0) {
    console.log("No open markets found in the window. Try again later or widen --window.");
    return;
  }
  console.log(`Found ${candidates.length} candidate markets.`);

  const leagues = Array.from(new Map(candidates.map((c) => [c.leagueName, { sport: c.sport, leagueName: c.leagueName }])).values());
  const teamNames = Array.from(new Set(candidates.flatMap((c) => [c.homeTeam, c.awayTeam])));

  console.log("Fetching free intel (ESPN headlines, recent form)...");
  const [espnHeadlines, formEntries] = await Promise.all([
    fetchRelevantNews(leagues, teamNames),
    Promise.all(
      teamNames.slice(0, 80).map(async (t) => [t, await fetchRecentForm(t)] as const),
    ),
  ]);
  const formByTeam = new Map(formEntries.filter(([, f]) => f !== null) as [string, string][]);

  console.log("Gathering live intel via LLM web search...");
  const { briefing, webCandidates } = await gatherIntel(candidates, espnHeadlines, formByTeam);
  if (webCandidates.length > 0) {
    console.log(`Gather stage found ${webCandidates.length} additional web candidate(s).`);
  }

  console.log("Selecting picks...");
  const result = await selectPicks(candidates, briefing, webCandidates, state);

  printPicks(result, { ...state, day: state.status === "active" ? state.day : 1 }, stakeUnits);
  writePicksFile(result, { ...state, day: state.status === "active" ? state.day : 1 });

  const entry: DailyEntry = {
    date: today,
    day: state.status === "active" ? state.day : 1,
    verdict: result.verdict,
    selections: result.selections,
    combinedOdds: result.combinedOdds,
    stakeUnits: result.verdict === "BET" ? stakeUnits : 0,
    potentialReturnUnits: result.verdict === "BET" ? stakeUnits * result.combinedOdds : 0,
    status: result.verdict === "BET" ? "pending" : "skipped",
    summary: result.verdict === "BET" ? result.summary : (result.skipReason ?? ""),
  };

  if (state.status === "idle" && result.verdict === "BET") {
    state.status = "active";
    state.day = 1;
    state.startDate = today;
    state.bankrollUnits = stakeUnits;
  }
  state.history.push(entry);
  saveState(state);
}

async function cmdResolve(args: string[]) {
  const outcome = args[0];
  if (outcome !== "win" && outcome !== "loss") {
    console.log("Usage: resolve <win|loss>");
    return;
  }

  const state = loadState();
  const pending = state.history.find((h) => h.status === "pending");
  if (!pending) {
    console.log("No pending pick to resolve.");
    return;
  }

  if (outcome === "win") {
    pending.status = "won";
    state.bankrollUnits = pending.potentialReturnUnits;
    if (pending.day >= 10) {
      state.status = "completed";
    } else {
      state.day = pending.day + 1;
    }
  } else {
    pending.status = "lost";
    state.status = "idle";
    state.day = 0;
    state.bankrollUnits = 0;
  }

  saveState(state);
  printResolveSummary(pending, state);
}

async function main() {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case "pick":
    case undefined:
      await cmdPick(args);
      break;
    case "resolve":
      await cmdResolve(args);
      break;
    case "status":
      printState(loadState());
      break;
    default:
      console.log(`Unknown command: ${cmd}`);
      console.log("Usage: pick | resolve <win|loss> | status");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
