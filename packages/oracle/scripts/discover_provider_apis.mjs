#!/usr/bin/env node
/**
 * API Discovery Script
 * Visits each sportsbook and logs all JSON API calls so we can build targeted scrapers.
 */
import { chromium } from "playwright";

const PROVIDERS = {
  oneXbet: {
    name: "1xBet",
    url: "https://1xbet.com/en/line/football",
    wait: "domcontentloaded",
  },
  betKing: {
    name: "BetKing",
    url: "https://www.betking.com/sports/s/soccer-1/",
    wait: "domcontentloaded",
  },
  bet22: {
    name: "22Bet",
    url: "https://22bet.com/en/sport/Football",
    wait: "domcontentloaded",
  },
  mozzartbet: {
    name: "Mozzartbet",
    url: "https://www.mozzartbet.com/ng/matches#sport-Football",
    wait: "domcontentloaded",
  },
  melbet: {
    name: "Melbet",
    url: "https://melbet.com/en/sport/Football",
    wait: "domcontentloaded",
  },
  betWinner: {
    name: "BetWinner",
    url: "https://betwinner.com/ng/sport/Football",
    wait: "domcontentloaded",
  },
  accessBET: {
    name: "AccessBET",
    url: "https://www.accessbet.com/sports",
    wait: "domcontentloaded",
  },
  betika: {
    name: "Betika",
    url: "https://www.betika.com/en-gb/s/?sport=Soccer",
    wait: "domcontentloaded",
  },
};

async function discoverAPIs(key, provider) {
  const apis = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });

    const page = await ctx.newPage();

    page.on("response", async (resp) => {
      const url = resp.url();
      const ct = resp.headers()["content-type"] || "";
      const status = resp.status();

      if (!ct.includes("application/json")) return;
      if (status >= 400) return;

      // Only log non-trivial endpoints (skip tracking/analytics)
      if (
        url.includes("google") ||
        url.includes("facebook") ||
        url.includes("analytics") ||
        url.includes("sentry") ||
        url.includes("hotjar") ||
        url.includes("gtm") ||
        url.includes("captcha") ||
        url.includes("doubleclick")
      )
        return;

      try {
        const data = await resp.json();
        const size = JSON.stringify(data).length;

        // Only log potentially useful endpoints (min 100 bytes of JSON)
        if (size < 100) return;

        const topKeys = typeof data === "object" && !Array.isArray(data)
          ? Object.keys(data).slice(0, 6)
          : ["[array]"];

        apis.push({
          url: url.substring(0, 120),
          status,
          size,
          topKeys,
        });
      } catch (e) {
        // ignore
      }
    });

    await page.goto(provider.url, {
      waitUntil: provider.wait,
      timeout: 20000,
    });

    // Wait for XHR calls to fire
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);

    await ctx.close();
  } catch (err) {
    apis.push({ error: err.message.substring(0, 80) });
  } finally {
    if (browser) await browser.close();
  }

  return apis;
}

async function main() {
  const target = process.argv[2];
  const providersToTest = target
    ? Object.fromEntries(
        Object.entries(PROVIDERS).filter(([k]) =>
          k.toLowerCase() === target.toLowerCase()
        )
      )
    : PROVIDERS;

  for (const [key, provider] of Object.entries(providersToTest)) {
    console.log(`\n===== ${provider.name} =====`);
    console.log(`URL: ${provider.url}`);

    const apis = await discoverAPIs(key, provider);

    if (apis.length === 0) {
      console.log("  No JSON APIs captured");
      continue;
    }

    if (apis[0]?.error) {
      console.log(`  Error: ${apis[0].error}`);
      continue;
    }

    console.log(`  Captured ${apis.length} JSON API calls:`);
    for (const api of apis.slice(0, 8)) {
      console.log(`    [${api.status}] ${api.url}`);
      console.log(`         keys: ${api.topKeys.join(", ")} | size: ${api.size}b`);
    }
  }
}

main().catch(console.error);
