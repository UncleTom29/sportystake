#!/usr/bin/env node

import { chromium } from "playwright";

async function test() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  console.log("Browser launched");

  const context = await browser.newContext({
    locale: "en-US",
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
  console.log("Context created");

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  console.log("Page created");

  // Track all responses
  page.on("response", (response) => {
    console.log(`[${response.status()}] ${response.url()}`);
  });

  // Track errors
  page.on("error", (err) => {
    console.error("PAGE ERROR:", err);
  });

  try {
    console.log("Navigating to Bet9ja...");
    const response = await page.goto("https://sports.bet9ja.com/ng/sport/football/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    console.log(`Navigation response: ${response.status()}`);

    console.log("Waiting for network idle...");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    console.log("Network idle reached");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

test();
