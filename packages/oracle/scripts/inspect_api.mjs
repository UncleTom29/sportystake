#!/usr/bin/env node
import { chromium } from "playwright";

async function inspectAPI() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const captured = [];

  page.on("response", async (resp) => {
    const url = resp.url();
    const ct = resp.headers()["content-type"] || "";

    if (!url.includes("/api/") || !ct.includes("application/json")) return;

    try {
      const data = await resp.json();
      if (captured.length < 5) {
        captured.push({
          url: url.substring(0, 100),
          keys: Object.keys(data).slice(0, 8),
          sample: JSON.stringify(data).substring(0, 200),
        });
      }
    } catch (e) {
      //
    }
  });

  try {
    console.log("SportyBet API inspection...");
    await page.goto("https://sportybet.com/ng/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1500);

    console.log(`\nCaptured ${captured.length} API responses:\n`);
    captured.forEach((c, i) => {
      console.log(`[${i + 1}] ${c.url}`);
      console.log(`    Keys: ${c.keys.join(", ")}`);
      console.log(`    Data: ${c.sample}...\n`);
    });
  } finally {
    await ctx.close();
    await browser.close();
  }
}

inspectAPI();
