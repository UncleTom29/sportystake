#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function safeJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} returned invalid JSON: ${String(err)}`);
  }
}

function main() {
  const cwd = process.cwd();

  const baseJsonRaw = run("docker", [
    "run",
    "--rm",
    "-v",
    `${cwd}/scripts:/work`,
    "python:3.10-slim",
    "sh",
    "-lc",
    "pip install --no-cache-dir requests >/dev/null && python /work/naijabet_extended_probe.py --bookmaker both --json",
  ]);

  const sportyJsonRaw = run("node", ["scripts/sportybet_playwright_probe.mjs", "--json"]);

  const base = safeJson(baseJsonRaw, "naijabet_extended_probe.py");
  const sporty = safeJson(sportyJsonRaw, "sportybet_playwright_probe.mjs");

  const sportyRows = Array.isArray(sporty.rows) ? sporty.rows : [];

  const baseSummary = base.summary || {};

  // Run direct HTTP scrapers (1xBet, Melbet, 22Bet, BetWinner, BetKing)
  let multiRows = [];
  try {
    const multiJsonRaw = run("python3", [`${cwd}/scripts/multi_provider_direct.py`], {
      timeout: 360_000,
    });
    const parsed = safeJson(multiJsonRaw, "multi_provider_direct.py");
    multiRows = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`[WARN] multi_provider_direct.py failed: ${err.message?.slice(0, 120)}`);
  }

  const sportyLeagues = new Set(sportyRows.map((r) => String(r.league || "Unknown")));
  const sportySports = new Set(sportyRows.map((r) => String(r.sport || "Unknown")));
  const multiLeagues = new Set(multiRows.map((r) => String(r.league || "Unknown")));
  const multiBookmakers = [...new Set(multiRows.map((r) => r.bookmaker))];

  const merged = {
    mode: "allbooks-playwright",
    bookmakers: {
      baseProbe: "bet9ja+nairabet",
      browserProbe: "sportybet",
      directProbe: multiBookmakers,
    },
    totals: {
      rows: Number(baseSummary.matches_total_rows || 0) + sportyRows.length + multiRows.length,
      sports: Number(baseSummary.sports_count || 0) + (sportyRows.length ? sportySports.size : 0),
      leagues: Number(baseSummary.leagues_count || 0) + sportyLeagues.size + multiLeagues.size,
    },
    baseSummary,
    sportybet: {
      captures: Number(sporty.captures || 0),
      rows: sportyRows.length,
      sports: [...sportySports],
      leagues: [...sportyLeagues].sort(),
      errors: Array.isArray(sporty.errors) ? sporty.errors : [],
      sample: sportyRows.slice(0, 5),
    },
    directProviders: {
      rows: multiRows.length,
      bookmakers: multiBookmakers,
      leagues: [...multiLeagues].sort(),
      sample: multiRows.slice(0, 5),
      byBookmaker: multiBookmakers.reduce((acc, bm) => {
        acc[bm] = multiRows.filter((r) => r.bookmaker === bm).length;
        return acc;
      }, {}),
    },
    baseErrors: Array.isArray(base.errors) ? base.errors : [],
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(merged)}\n`);
    return;
  }

  console.log("mode:", merged.mode);
  console.log("totals.rows:", merged.totals.rows);
  console.log("totals.sports:", merged.totals.sports);
  console.log("totals.leagues:", merged.totals.leagues);
  console.log("sportybet.captures:", merged.sportybet.captures);
  console.log("sportybet.rows:", merged.sportybet.rows);
  console.log("directProviders.rows:", merged.directProviders.rows);
  console.log("directProviders.byBookmaker:", JSON.stringify(merged.directProviders.byBookmaker));
  if (merged.sportybet.sample.length > 0) {
    console.log("sportybet.sample:");
    for (const row of merged.sportybet.sample) {
      console.log(`  - ${row.match} | ${row.odds?.home ?? "-"}/${row.odds?.draw ?? "-"}/${row.odds?.away ?? "-"}`);
    }
  }
  if (merged.directProviders.sample.length > 0) {
    console.log("directProviders.sample:");
    for (const row of merged.directProviders.sample) {
      console.log(`  - [${row.bookmaker}] ${row.match} | ${row.home_odds ?? "-"}/${row.draw_odds ?? "-"}/${row.away_odds ?? "-"}`);
    }
  }
  if (merged.baseErrors.length > 0 || merged.sportybet.errors.length > 0) {
    console.log("errors:");
    for (const err of merged.baseErrors.slice(0, 5)) {
      console.log(`  - ${err.bookmaker} ${err.league}: ${err.error}`);
    }
    for (const err of merged.sportybet.errors.slice(0, 5)) {
      console.log(`  - sportybet ${err.status} bizCode=${err.bizCode ?? "-"} ${err.message ?? ""}`);
    }
  }
}

try {
  main();
} catch (err) {
  console.error(String(err?.message || err));
  process.exit(1);
}
