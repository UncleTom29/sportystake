/**
 * Deep probe AccessBET and Mozzartbet - look for match/events APIs
 */
import { chromium } from "playwright";

async function probeProvider(name, url, extraWait = 0) {
  const calls = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();

    page.on("response", async (r) => {
      const u = r.url();
      const ct = r.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      if (r.status() >= 400) return;
      try {
        const body = await r.json();
        const raw = JSON.stringify(body);
        const sz = raw.length;
        if (sz < 100) return;
        calls.push({ url: u.slice(0, 160), sz, snippet: raw.slice(0, 500) });
      } catch {}
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      calls.push({ error: "goto: " + e.message.slice(0, 80) });
      await ctx.close();
      return calls;
    }
    await page.waitForTimeout(8000 + extraWait);
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(3000);

    await ctx.close();
  } catch (e) {
    calls.push({ error: e.message.slice(0, 100) });
  } finally {
    if (browser) await browser.close();
  }
  return calls;
}

console.log("=== AccessBET sports page ===");
const accessCalls = await probeProvider(
  "AccessBET",
  "https://www.accessbet.com/sports/football",
  3000
);
for (const c of accessCalls.slice(0, 12)) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b ${c.url}`);
  console.log("  =>", c.snippet.slice(0, 200));
}

console.log("\n=== Mozzartbet sports page ===");
const mozzCalls = await probeProvider(
  "Mozzartbet",
  "https://www.mozzartbet.com/ng/matches",
  5000
);
for (const c of mozzCalls.slice(0, 12)) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b ${c.url}`);
  console.log("  =>", c.snippet.slice(0, 200));
}
