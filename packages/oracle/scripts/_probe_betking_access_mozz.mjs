/**
 * Deep probe for BetKing and AccessBET - capture all JSON API calls with full body samples
 */
import { chromium } from "playwright";

async function probeProvider(name, url, filterFn, waitMs = 5000) {
  const calls = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();

    page.on("response", async (r) => {
      const u = r.url();
      const ct = r.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      if (!filterFn(u)) return;
      const status = r.status();
      if (status >= 400) return;
      try {
        const body = await r.json();
        const sz = JSON.stringify(body).length;
        if (sz < 50) return;
        const snippet = JSON.stringify(body).slice(0, 300);
        calls.push({ url: u.slice(0, 150), status, sz, snippet });
      } catch {}
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(waitMs);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);

    await ctx.close();
  } catch (e) {
    calls.push({ error: e.message.slice(0, 100) });
  } finally {
    if (browser) await browser.close();
  }
  return calls;
}

console.log("=== BetKing Deep Probe ===");
const betKingCalls = await probeProvider(
  "BetKing",
  "https://www.betking.com/sports/s/soccer-1/",
  (u) => u.includes("betking") || u.includes("kingmakers"),
  8000
);
for (const c of betKingCalls) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b [${c.status}] ${c.url}`);
  console.log("   sample:", c.snippet.slice(0, 200));
}

console.log("\n=== AccessBET Deep Probe ===");
const accessCalls = await probeProvider(
  "AccessBET",
  "https://www.accessbet.com/sports",
  (u) => u.includes("accessbet"),
  8000
);
for (const c of accessCalls) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b [${c.status}] ${c.url}`);
  console.log("   sample:", c.snippet.slice(0, 200));
}

console.log("\n=== Mozzartbet Deep Probe ===");
const mozzCalls = await probeProvider(
  "Mozzartbet",
  "https://www.mozzartbet.com/ng/matches",
  (u) => u.includes("mozzartbet"),
  10000
);
for (const c of mozzCalls) {
  if (c.error) { console.log("ERROR:", c.error); continue; }
  console.log(`${c.sz}b [${c.status}] ${c.url}`);
  console.log("   sample:", c.snippet.slice(0, 200));
}
