#!/usr/bin/env node

import { chromium } from "playwright";

async function debug() {
  const provider = {
    name: "SportyBet",
    url: "https://sportybet.com/ng/",
  };

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  let responseCount = 0;

  page.on("response", (response) => {
    responseCount++;
    const url = response.url();
    const ct = response.headers()["content-type"] || "";
    if (responseCount <= 50) {
      console.log(
        `[${response.status()}] ${url.substring(0, 120)} | ct=${ct.substring(0, 40)}`
      );
    }
  });

  try {
    console.log(`Navigating to ${provider.url}...`);
    await page.goto(provider.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("Page loaded, waiting for network idle...");
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    console.log(`Total responses: ${responseCount}`);

    // Scroll
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);
    console.log(`After scroll: ${responseCount} total responses`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

debug();
