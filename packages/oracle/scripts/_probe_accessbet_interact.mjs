/**
 * Deep interact with AccessBET - click into leagues to trigger events API
 */
import { chromium } from "playwright";

const br = await chromium.launch({ headless: true });
const ctx = await br.newContext({
  locale: "en-US",
  viewport: { width: 1920, height: 1080 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();

const calls = [];
page.on("response", async (r) => {
  const u = r.url();
  const ct = r.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  if (r.status() >= 400) return;
  if (u.includes("translations") || u.includes("session")) return;
  try {
    const body = await r.json();
    const raw = JSON.stringify(body);
    const sz = raw.length;
    if (sz < 100) return;
    calls.push({ url: u.slice(0, 160), sz, snippet: raw.slice(0, 600) });
  } catch {}
});

console.log("Going to AccessBET...");
try {
  await page.goto("https://www.accessbet.com/sports/football", {
    waitUntil: "domcontentloaded", timeout: 30000
  });
} catch (e) {
  console.error("goto failed:", e.message.slice(0, 80));
}

await page.waitForTimeout(5000);
console.log("Page URL:", page.url());

// Try clicking on football leagues
const html = await page.content();
console.log("Page size:", html.length, "chars");

// Look for clickable league elements
const elements = await page.locator('a, button, [role="button"]').all();
console.log("Clickable elements:", elements.length);

// Try to find league links
const links = await page.$$('a[href*="football"], a[href*="soccer"], a[href*="sport"]');
console.log("Sport links:", links.length);

await page.mouse.wheel(0, 500);
await page.waitForTimeout(3000);

// Show all captured calls
for (const c of calls) {
  console.log(`${c.sz}b ${c.url}`);
  console.log("  =>", c.snippet.slice(0, 250));
}

await br.close();
