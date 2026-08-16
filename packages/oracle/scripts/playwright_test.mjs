#!/usr/bin/env node
import { chromium } from "playwright";

const PROVIDERS = {
  sportybet: {
    name: "SportyBet",
    url: "https://sportybet.com/ng/",
    apiPatterns: ["factsCenter", "api"],
  },
  betKing: {
    name: "BetKing",
    url: "https://www.betking.com/",
    apiPatterns: ["api"],
  },
};

function extractRows(data, bookmaker) {
  const rows = [];
  const seen = new Set();

  function walk(obj, depth) {
    if (depth > 10 || !obj) return;
    if (typeof obj !== "object") return;
    if (seen.has(obj)) return;
    seen.add(obj);

    if ((obj.homeTeam || obj.home_team) && (obj.awayTeam || obj.away_team)) {
      const home = String(obj.homeTeam || obj.home_team || "").trim();
      const away = String(obj.awayTeam || obj.away_team || "").trim();
      if (home && away) {
        rows.push({
          bookmaker,
          match: `${home} vs ${away}`,
        });
      }
    }

    const vals = Object.values(obj);
    for (const v of vals) {
      if (typeof v === "object") walk(v, depth + 1);
    }
  }

  walk(data, 0);
  return rows;
}

async function test() {
  for (const [key, provider] of Object.entries(PROVIDERS)) {
    console.log(`\n📍 ${provider.name}...`);
    let captures = 0;
    let rows = 0;

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      page.on("response", async (resp) => {
        const url = resp.url();
        const ct = resp.headers()["content-type"] || "";
        const isApi = provider.apiPatterns.some((p) =>
          url.toLowerCase().includes(p.toLowerCase())
        );

        if (!isApi || !ct.includes("application/json")) return;

        try {
          const data = await resp.json();
          captures++;
          const extracted = extractRows(data, provider.name);
          rows += extracted.length;
        } catch (e) {
          // ignore
        }
      });

      await page.goto(provider.url, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      await page.waitForTimeout(2000);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1500);

      console.log(`   Captures: ${captures} | Rows: ${rows}`);
      await ctx.close();
    } catch (err) {
      console.log(`   Error: ${err.message.substring(0, 60)}`);
    } finally {
      if (browser) await browser.close();
    }
  }
}

test();
