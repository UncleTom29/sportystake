/**
 * Probe Mozzartbet and Betika with long wait and interaction
 */
import { chromium } from "playwright";

async function probe(name, url, filterFn, waitMs = 15000) {
  const calls = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();

    page.on("response", async (r) => {
      const u = r.url();
      const ct = r.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      if (r.status() >= 400) return;
      if (!filterFn(u)) return;
      try {
        const body = await r.json();
        const raw = JSON.stringify(body);
        if (raw.length < 200) return;
        calls.push({ url: u.slice(0, 160), sz: raw.length, snippet: raw.slice(0, 500) });
      } catch {}
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    } catch (e) {
      console.log(`  goto partial timeout: ${e.message.slice(0, 60)}`);
    }

    await page.waitForTimeout(waitMs);
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(4000);

    await ctx.close();
  } catch (e) {
    calls.push({ error: e.message.slice(0, 100) });
  } finally {
    if (browser) await browser.close();
  }
  return calls;
}

console.log("=== Mozzartbet probe ===");
const mozzCalls = await probe(
  "Mozzartbet",
  "https://www.mozzartbet.com/ng/matches",
  (u) => u.includes("mozzartbet") || u.includes("mozzart"),
  15000
);
for (const c of mozzCalls.slice(0, 15)) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b ${c.url}`);
  console.log("  =>", c.snippet.slice(0, 200));
}

console.log("\n=== Betika probe ===");
const beticaCalls = await probe(
  "Betika",
  "https://www.betika.com/en-gb/s/?sport=Soccer",
  (u) => u.includes("betika") || u.includes("api.betika"),
  15000
);
for (const c of beticaCalls.slice(0, 15)) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b ${c.url}`);
  console.log("  =>", c.snippet.slice(0, 200));
}
