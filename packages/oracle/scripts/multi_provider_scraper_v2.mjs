#!/usr/bin/env node

import { chromium } from "playwright";

const PROVIDERS = {
  bet9ja: {
    name: "Bet9ja",
    url: "https://sports.bet9ja.com/ng/sport/football/",
    apiPatterns: ["factsCenter", "betslip", "odds", "api", "markets"],
  },
  oneXbet: {
    name: "1xBet",
    url: "https://1xbet.com/en/live",
    apiPatterns: ["api", "odds", "events", "markets"],
  },
  betKing: {
    name: "BetKing",
    url: "https://www.betking.com/",
    apiPatterns: ["api", "odds", "markets", "events"],
  },
  bet22: {
    name: "22Bet",
    url: "https://22bet.com/en/live",
    apiPatterns: ["api", "odds", "markets"],
  },
  mozzartbet: {
    name: "Mozzartbet",
    url: "https://www.mozzartbet.com/ng/",
    apiPatterns: ["api", "odds", "markets"],
  },
  melbet: {
    name: "Melbet",
    url: "https://melbet.com/en/live",
    apiPatterns: ["api", "odds", "markets"],
  },
  betWinner: {
    name: "BetWinner",
    url: "https://betwinner.com/ng/live",
    apiPatterns: ["api", "odds", "markets"],
  },
  nairabet: {
    name: "Nairabet",
    url: "https://nairabet.com/sports",
    apiPatterns: ["api", "odds", "markets", "events"],
  },
  accessBET: {
    name: "AccessBET",
    url: "https://www.accessbet.com/",
    apiPatterns: ["api", "odds", "markets"],
  },
  betika: {
    name: "Betika",
    url: "https://www.betika.com/en/live/sports",
    apiPatterns: ["api", "odds", "markets", "events"],
  },
  sportybet: {
    name: "SportyBet",
    url: "https://sportybet.com/ng/",
    apiPatterns: ["factsCenter", "api", "odds", "markets", "events"],
  },
};

function parseGenericOdds(obj) {
  if (!obj) return {};

  if (Array.isArray(obj)) {
    const [h, d, a] = obj;
    if (h && d && a) return { home: parseFloat(h), draw: parseFloat(d), away: parseFloat(a) };
    return { odds: obj };
  }

  const odds = {};
  if (obj.h || obj.home) odds.home = parseFloat(obj.h || obj.home);
  if (obj.d || obj.draw) odds.draw = parseFloat(obj.d || obj.draw);
  if (obj.a || obj.away) odds.away = parseFloat(obj.a || obj.away);
  if (obj.w1 || obj.match_odds) {
    odds.home = parseFloat(obj.w1 || obj.match_odds);
    odds.draw = parseFloat(obj.d || obj.draw);
    odds.away = parseFloat(obj.w2 || obj.away);
  }

  return Object.keys(odds).length > 0 ? odds : obj;
}

function extractEventRows(data, bookmaker) {
  const rows = [];
  const seen = new Set();

  function walk(obj, depth = 0) {
    if (depth > 15 || !obj || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);

    if (
      obj.homeTeam ||
      obj.awayTeam ||
      obj.home_team ||
      obj.away_team ||
      obj.h2h ||
      obj.match ||
      obj.game
    ) {
      const homeTeam = String(
        obj.homeTeam || obj.home_team || obj.team1 || obj.h || ""
      ).trim();
      const awayTeam = String(
        obj.awayTeam || obj.away_team || obj.team2 || obj.a || ""
      ).trim();

      if (homeTeam && awayTeam) {
        const match = `${homeTeam} vs ${awayTeam}`;
        const sport = obj.sport || "football";
        const league = String(
          obj.league || obj.competition || obj.tournament || "Unknown"
        ).trim();
        const match_id = String(obj.id || obj.eventId || obj.matchId || "").trim();

        const oddsObj =
          obj.odds ||
          obj.h2h ||
          obj.marketOdds ||
          obj.match_odds ||
          {
            home: obj.homeOdds || obj.h2h?.home,
            draw: obj.drawOdds || obj.h2h?.draw,
            away: obj.awayOdds || obj.h2h?.away,
          };

        const rowKey = `${match_id || match}|${league}`;
        if (!seen.has(rowKey)) {
          seen.add(rowKey);
          rows.push({
            bookmaker,
            sport,
            league,
            match_id,
            match,
            start_time: String(obj.startTime || obj.kickoff || obj.time || "").trim(),
            odds: parseGenericOdds(oddsObj),
          });
        }
      }
    }

    for (const value of Object.values(obj)) {
      walk(value, depth + 1);
    }
  }

  walk(data);
  return rows;
}

async function captureProvider(provider, timeoutMs = 30000) {
  const result = {
    name: provider.name,
    url: provider.url,
    captures: 0,
    rows: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "Africa/Lagos",
    deviceScaleFactor: 1,
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "application/json, text/plain, */*",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();

  // Block unnecessary resources for speed
  await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,css,woff,woff2}", (route) =>
    route.abort()
  );

  const apiResponses = [];

  page.on("response", async (response) => {
    const url = response.url();
    const ct = String(response.headers()["content-type"] || "").toLowerCase();

    const isApi = provider.apiPatterns.some((pat) =>
      url.toLowerCase().includes(pat.toLowerCase())
    );

    if (!isApi) return;

    const status = response.status();
    let body = null;
    let parseError = null;

    if (ct.includes("application/json")) {
      try {
        body = await response.json();
      } catch (err) {
        parseError = String(err);
      }
    }

    if (body) {
      apiResponses.push({ url, status, body });
    } else if (parseError && status < 400) {
      result.errors.push({ url, status, error: parseError });
    }
  });

  try {
    await page.goto(provider.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 15000) });

    // Simulate scrolling to trigger lazy-loaded content
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1500);

    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1500);

    result.captures = apiResponses.length;

    // Extract events from all API responses
    for (const { body } of apiResponses) {
      const extracted = extractEventRows(body, provider.name);
      result.rows.push(...extracted);
    }

    // Deduplicate rows
    const uniqueRows = [];
    const rowKeys = new Set();
    for (const row of result.rows) {
      const key = `${row.match_id || row.match}|${row.league}`;
      if (!rowKeys.has(key)) {
        rowKeys.add(key);
        uniqueRows.push(row);
      }
    }
    result.rows = uniqueRows;
  } catch (err) {
    result.errors.push({ error: String(err) });
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

async function main() {
  const timeoutMs = Number(
    process.argv[process.argv.indexOf("--timeout-ms") + 1] || "30000"
  );
  const outputJson = process.argv.includes("--json");
  const providersArg = process.argv[process.argv.indexOf("--providers") + 1];
  const providersFilter = providersArg
    ? providersArg.split(",").map((s) => s.trim())
    : Object.keys(PROVIDERS);

  const results = [];

  for (const keyArg of providersFilter) {
    const key = Object.keys(PROVIDERS).find(
      (k) => k.toLowerCase() === keyArg.toLowerCase()
    );
    if (!key) {
      console.warn(
        `Unknown provider: ${keyArg}. Available: ${Object.keys(PROVIDERS).join(", ")}`
      );
      continue;
    }

    try {
      const result = await captureProvider(PROVIDERS[key], timeoutMs);
      results.push(result);
    } catch (err) {
      results.push({
        name: PROVIDERS[key].name,
        url: PROVIDERS[key].url,
        captures: 0,
        rows: [],
        errors: [{ error: String(err) }],
      });
    }
  }

  const summary = {
    mode: "multi-provider",
    providers: results.length,
    totalRows: results.reduce((s, r) => s + r.rows.length, 0),
    totalCaptures: results.reduce((s, r) => s + r.captures, 0),
    results,
  };

  if (outputJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("\n=== Multi-Provider Scraper ===");
    console.log(`providers: ${summary.providers}`);
    console.log(`total_rows: ${summary.totalRows}`);
    console.log(`total_captures: ${summary.totalCaptures}`);
    console.log("\n=== Provider Results ===\n");
    for (const r of results) {
      console.log(`${r.name}:`);
      console.log(`  captures: ${r.captures}`);
      console.log(`  rows: ${r.rows.length}`);
      if (r.errors.length > 0) {
        console.log(`  errors: ${r.errors.length}`);
      }
    }
  }
}

main().catch(console.error);
