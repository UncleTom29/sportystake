#!/usr/bin/env node

import { chromium } from "playwright";

async function testProvider() {
  console.log("Starting SportyBet capture...");

  const provider = {
    name: "SportyBet",
    url: "https://sportybet.com/ng/",
    apiPatterns: ["factsCenter", "api"],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Block media
  await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,css,woff,woff2}", (route) =>
    route.abort()
  );

  const apiResponses = [];
  let capturedCount = 0;

  page.on("response", async (response) => {
    const url = response.url();
    const ct = String(response.headers()["content-type"] || "").toLowerCase();

    // Check if this is an API endpoint
    const isApi = provider.apiPatterns.some((pat) =>
      url.toLowerCase().includes(pat.toLowerCase())
    );

    if (!isApi) return;

    const status = response.status();
    if (ct.includes("application/json")) {
      try {
        const body = await response.json();
        apiResponses.push({ url, status, body });
        capturedCount++;
        if (capturedCount <= 3) {
          console.log(`Captured: ${url.substring(0, 100)}...`);
        }
      } catch (err) {
        console.log(`Parse error: ${url.substring(0, 80)}... - ${err.message}`);
      }
    }
  });

  try {
    await page.goto(provider.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("Page loaded, waiting for network...");
    
    // Use longer timeout
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    console.log("Network idle reached");

    // Scroll to trigger more API calls
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(3000);

    console.log(`\n=== Results ===`);
    console.log(`API Responses Captured: ${capturedCount}`);
    console.log(`JSON Payloads Collected: ${apiResponses.length}`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testProvider();
