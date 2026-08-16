#!/usr/bin/env node

import { chromium } from "playwright";

async function debugCapture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log all network responses
  page.on("response", async (response) => {
    const url = response.url();
    const status = response.status();
    const ct = response.headers()["content-type"] || "";
    console.log(`[${status}] ${url.substring(0, 100)}... content-type=${ct}`);
  });

  // Log all requests
  page.on("request", (request) => {
    const url = request.url();
    const method = request.method();
    if (!url.includes(".png") && !url.includes(".css") && !url.includes(".woff")) {
      console.log(`[REQUEST] ${method} ${url.substring(0, 100)}...`);
    }
  });

  try {
    console.log("Navigating to Bet9ja...");
    await page.goto("https://sports.bet9ja.com/ng/sport/football/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("Page loaded, waiting for network idle...");
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    console.log("Network idle reached.");

    // Scroll to trigger more loads
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(2000);
    console.log("Scroll 1 done");

    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(2000);
    console.log("Scroll 2 done");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

debugCapture();
