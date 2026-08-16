#!/usr/bin/env node

import { chromium } from "playwright";

const PROVIDERS = {
  bet9ja: {
    url: "https://sports.bet9ja.com/ng/sport/football/",
    name: "Bet9ja",
    apiPatterns: [
      "PalimpsestAjax/GetEventsInGroupV2",
      "PalimpsestAjax/GetSports",
    ],
  },
  oneXbet: {
    url: "https://1xbet.ng/en/live/",
    name: "1xBet",
    apiPatterns: ["/LiveFeed/", "/ValueFeed/", "getEvents", "getMatches"],
  },
  betKing: {
    url: "https://www.betking.com/ng/sports/football",
    name: "BetKing",
    apiPatterns: ["api", "events", "odds", "markets"],
  },
  bet22: {
    url: "https://22bet.ng/en/sport/football/",
    name: "22Bet",
    apiPatterns: ["/api/", "events", "getEvents", "getMatches"],
  },
  mozzartbet: {
    url: "https://www.mozzartbet.com/ng/sports",
    name: "Mozzartbet",
    apiPatterns: ["api", "events", "odds", "football"],
  },
  melbet: {
    url: "https://melbet.ng/en/",
    name: "Melbet",
    apiPatterns: ["api", "events", "matches", "odds"],
  },
  betWinner: {
    url: "https://betwinner.ng/",
    name: "BetWinner",
    apiPatterns: ["api", "events", "sports", "football"],
  },
  nairabet: {
    url: "https://nairabet.com/ng/sports/football",
    name: "Nairabet",
    apiPatterns: ["api", "events", "v2", "sports"],
  },
  accessBET: {
    url: "https://www.accessbet.ng/sports/football",
    name: "AccessBET",
    apiPatterns: ["api", "events", "odds", "markets"],
  },
  betika: {
    url: "https://www.betika.com/sports",
    name: "Betika",
    apiPatterns: ["api", "events", "matches", "odds"],
  },
};

function toFloat(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function parseGenericOdds(obj) {
  if (typeof obj !== "object" || !obj) return null;

  // Try common 1X2 patterns
  const candidates = [
    // Nested odds patterns
    obj.odds,
    obj.odd,
    obj.price,
    obj.prices,
    obj.markets?.[0]?.outcomes,
    obj.market?.outcomes,
    obj.outcomes,
    obj.mainOdds,
    obj.betOdds,
    obj.data?.odds,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    // Handle array format [home, draw, away]
    if (Array.isArray(candidate) && candidate.length >= 3) {
      const vals = candidate.slice(0, 3).map(toFloat);
      if (vals.every((v) => v !== null)) {
        return { home: vals[0], draw: vals[1], away: vals[2] };
      }
    }

    // Handle object with numeric keys or properties
    if (typeof candidate === "object" && !Array.isArray(candidate)) {
      const keys = Object.keys(candidate);
      if (keys.length >= 3) {
        const vals = keys.slice(0, 3).map((k) => toFloat(candidate[k]));
        if (vals.every((v) => v !== null)) {
          return { home: vals[0], draw: vals[1], away: vals[2] };
        }
      }
    }
  }

  return null;
}

function extractOdds(oddsObj) {
  if (!oddsObj) return {};
  return {
    home: toFloat(oddsObj.home || oddsObj[0]),
    draw: toFloat(oddsObj.draw || oddsObj[1]),
    away: toFloat(oddsObj.away || oddsObj[2]),
  };
}

function extractEventRows(data, bookmaker, sport = "Soccer") {
  const rows = [];

  function walk(obj, depth = 0) {
    if (depth > 20 || !obj) return;
    if (typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        walk(item, depth + 1);
      }
      return;
    }

    // Check if this looks like an event/match object
    const hasTeamInfo = obj.homeTeam || obj.home || obj.homeName || obj.homeTeamName || obj.team1 || obj.teams?.[0];
    const hasOdds = obj.odds || obj.odd || obj.price || obj.markets || obj.outcomes;

    if (hasTeamInfo && hasOdds) {
      const home = String(
        obj.homeTeam || obj.home || obj.homeName || obj.homeTeamName || obj.team1 || obj.teams?.[0] || ""
      ).trim();
      const away = String(
        obj.awayTeam || obj.away || obj.awayName || obj.awayTeamName || obj.team2 || obj.teams?.[1] || ""
      ).trim();
      const match = [home, away].filter(Boolean).join(" - ") || String(obj.name || obj.title || "").trim();

      if (match) {
        const oddsObj = parseGenericOdds(obj);
        if (oddsObj) {
          rows.push({
            bookmaker,
            sport,
            league: String(obj.league || obj.competition || obj.tournament || "Unknown").trim() || "Unknown",
            match_id: String(obj.id || obj.eventId || obj.matchId || "").trim(),
            match,
            start_time: String(obj.startTime || obj.kickoff || obj.time || "").trim(),
            odds: extractOdds(oddsObj),
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

async function captureProvider(provider, timeoutMs) {
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
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Block unnecessary resources for speed
  await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,css,woff,woff2}", (route) => route.abort());

  const apiResponses = [];

  page.on("response", async (response) => {
    const url = response.url();
    const ct = String(response.headers()["content-type"] || "").toLowerCase();

    // Check if this is an API endpoint
    const isApi = provider.apiPatterns.some((pat) => url.toLowerCase().includes(pat.toLowerCase())) ||
      url.includes("/api/") ||
      (ct.includes("application/json") && !url.includes(".json"));

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
    await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 15000) });

    // Simulate scrolling to trigger lazy-loaded content
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1500);
  } catch (err) {
    result.errors.push({ url: provider.url, error: String(err) });
  } finally {
    await context.close();
    await browser.close();
  }

  result.captures = apiResponses.length;

  for (const { body, url } of apiResponses) {
    const extracted = extractEventRows(body, provider.name);
    result.rows.push(...extracted);
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

  const aggregated = {
    mode: "multi-provider",
    providers: results.length,
    totalRows: results.reduce((s, r) => s + r.rows.length, 0),
    totalCaptures: results.reduce((s, r) => s + r.captures, 0),
    results,
  };

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(aggregated)}\n`);
  } else {
    console.log("=== Multi-Provider Scraper ===");
    console.log("providers:", aggregated.providers);
    console.log("total_rows:", aggregated.totalRows);
    console.log("total_captures:", aggregated.totalCaptures);
    console.log("\n=== Provider Results ===");
    for (const r of results) {
      console.log(`\n${r.name}:`);
      console.log(`  captures: ${r.captures}`);
      console.log(`  rows: ${r.rows.length}`);
      if (r.rows.length > 0) {
        console.log("  sample:");
        for (const row of r.rows.slice(0, 3)) {
          const h = row.odds.home ?? "-";
          const d = row.odds.draw ?? "-";
          const a = row.odds.away ?? "-";
          console.log(`    - ${row.match} | ${h}/${d}/${a}`);
        }
      }
      if (r.errors.length > 0) {
        console.log(`  errors: ${r.errors.length}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
