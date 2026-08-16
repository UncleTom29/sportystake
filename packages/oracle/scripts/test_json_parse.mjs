#!/usr/bin/env node

import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Block media for speed
  await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,css,woff,woff2}", (route) =>
    route.abort()
  );

  let apiCount = 0;
  let parseErrors = 0;
  let successCount = 0;

  page.on("response", async (response) => {
    const url = response.url();
    const ct = String(response.headers()["content-type"] || "").toLowerCase();

    // Check if this looks like an API call
    if (url.includes("/api/") && ct.includes("application/json")) {
      apiCount++;
      try {
        const body = await response.json();
        successCount++;
        if (successCount <= 3) {
          console.log(`✓ Parsed: ${url.substring(0, 80)}...`);
          console.log(`  Keys: ${Object.keys(body).slice(0, 5).join(", ")}`);
        }
      } catch (err) {
        parseErrors++;
        if (parseErrors <= 3) {
          console.log(`✗ Parse error: ${url.substring(0, 80)}...`);
          console.log(`  Error: ${err.message}`);
        }
      }
    }
  });

  try {
    console.log("Navigating to SportyBet...");
    await page.goto("https://sportybet.com/ng/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("Waiting for network idle...");
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    console.log("Scrolling...");
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);

    console.log(`\n=== Results ===`);
    console.log(`API Responses: ${apiCount}`);
    console.log(`Successfully Parsed: ${successCount}`);
    console.log(`Parse Errors: ${parseErrors}`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

test();
