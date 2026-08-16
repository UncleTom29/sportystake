#!/usr/bin/env node

import { chromium } from "playwright";

function toFloat(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function parseEventOdds(event) {
  const marketLists = [
    event?.markets,
    event?.marketList,
    event?.marketGroups,
  ].filter(Array.isArray);

  for (const markets of marketLists) {
    for (const market of markets) {
      const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
      if (outcomes.length < 3) continue;

      const values = outcomes.slice(0, 3).map((o) => toFloat(o?.odds ?? o?.value));
      if (values.every((v) => v !== null)) {
        return {
          home: values[0],
          draw: values[1],
          away: values[2],
        };
      }
    }
  }

  return {};
}

function collectRowsFromNode(node, rows) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectRowsFromNode(item, rows);
    }
    return;
  }

  if (typeof node !== "object") return;

  const events = Array.isArray(node.events)
    ? node.events
    : Array.isArray(node.matches)
      ? node.matches
      : null;

  if (events) {
    for (const event of events) {
      if (!event || typeof event !== "object") continue;

      const home = String(event.homeTeamName ?? event.homeName ?? "").trim();
      const away = String(event.awayTeamName ?? event.awayName ?? "").trim();
      const match = home || away ? `${home} - ${away}` : String(event.matchName ?? "").trim();
      if (!match) continue;

      rows.push({
        bookmaker: "sportybet",
        sport: "Soccer",
        league: String(event.tournamentName ?? event.competitionName ?? "Unknown").trim() || "Unknown",
        match_id: String(event.eventId ?? event.id ?? "").trim(),
        match,
        start_time: String(event.matchTime ?? event.startTime ?? "").trim(),
        odds: parseEventOdds(event),
      });
    }
  }

  for (const value of Object.values(node)) {
    collectRowsFromNode(value, rows);
  }
}

function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.match_id}|${row.match}|${row.league}`;
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

async function run() {
  const timeoutMs = Number(argValue("--timeout-ms", "45000"));
  const outputJson = process.argv.includes("--json");
  const headed = process.argv.includes("--headed");

  const captures = [];

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/") || !url.includes("factsCenter")) return;

    const headers = response.headers();
    const ct = String(headers["content-type"] ?? "").toLowerCase();
    const status = response.status();

    let body = null;
    let parseError = null;
    if (ct.includes("application/json") || status >= 400) {
      try {
        body = await response.json();
      } catch (err) {
        parseError = String(err);
      }
    }

    captures.push({
      url,
      status,
      contentType: ct,
      body,
      parseError,
    });
  });

  try {
    await page.goto("https://www.sportybet.com/ng/sport/football/", {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 30000) });
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(2500);
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(2500);
  } finally {
    await context.close();
    await browser.close();
  }

  const rows = [];
  for (const capture of captures) {
    if (!capture.body || typeof capture.body !== "object") continue;
    collectRowsFromNode(capture.body, rows);
  }

  const deduped = dedupeRows(rows);
  const errors = captures
    .filter((c) => c.status >= 400 || (c.body && c.body.bizCode && c.body.bizCode !== 0 && c.body.bizCode !== 10000))
    .map((c) => ({
      url: c.url,
      status: c.status,
      bizCode: c.body?.bizCode,
      message: c.body?.message,
      parseError: c.parseError,
    }));

  const payload = {
    mode: "playwright",
    captures: captures.length,
    rows: deduped,
    errors,
  };

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  console.log("mode: playwright");
  console.log("captures:", payload.captures);
  console.log("rows:", deduped.length);
  if (deduped.length > 0) {
    console.log("sample rows:");
    for (const row of deduped.slice(0, 5)) {
      console.log(`  - ${row.match} | ${row.odds.home ?? "-"}/${row.odds.draw ?? "-"}/${row.odds.away ?? "-"}`);
    }
  }
  if (errors.length > 0) {
    console.log("errors:");
    for (const err of errors.slice(0, 5)) {
      console.log(`  - ${err.status} bizCode=${err.bizCode ?? "-"} ${err.message ?? ""} ${err.url}`);
    }
  }
}

run().catch((err) => {
  const message = String(err?.message ?? err);
  if (message.includes("Executable doesn't exist") || message.includes("Failed to launch")) {
    console.error("Playwright browser missing. Run: npx playwright install chromium");
  } else {
    console.error(message);
  }
  process.exit(1);
});
