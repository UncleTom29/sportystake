/**
 * Probe Melbet, BetWinner, 22Bet with correct URLs and longer wait
 * to find the actual match data API calls
 */
import { chromium } from "playwright";

async function probeProvider(name, url, waitMs = 12000) {
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

    const SKIP = [
      "analytics", "hotjar", "gtm", "sentry", "dictionary",
      "media_asset", "genfiles/cms", "favicons", "seodata",
      "contacts.json", "menu.json", "config/group",
    ];

    page.on("response", async (r) => {
      const u = r.url();
      const ct = r.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      const status = r.status();
      if (status >= 400) return;
      if (SKIP.some((s) => u.includes(s))) return;
      try {
        const body = await r.json();
        const sz = JSON.stringify(body).length;
        if (sz < 200) return;
        const snippet = JSON.stringify(body).slice(0, 500);
        calls.push({ url: u.slice(0, 150), status, sz, snippet });
      } catch {}
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    } catch (e) {
      calls.push({ error: "goto: " + e.message.slice(0, 80) });
      await ctx.close();
      return calls;
    }
    await page.waitForTimeout(waitMs);
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

const providers = [
  { name: "Melbet /line/Football", url: "https://melbet.com/en/line/Football" },
  { name: "BetWinner /line/Football", url: "https://betwinner.ng/en/line/Football" },
  { name: "22Bet /en/sport/Football", url: "https://22bet.com/en/sport/Football", waitMs: 15000 },
  { name: "22Bet ng", url: "https://22bet.ng/en/sport/Football", waitMs: 15000 },
];

for (const p of providers) {
  console.log(`\n===== ${p.name} =====`);
  const calls = await probeProvider(p.name, p.url, p.waitMs || 12000);
  if (!calls.length) {
    console.log("  No API calls captured");
    continue;
  }
  for (const c of calls.slice(0, 12)) {
    if (c.error) { console.log("  ERROR:", c.error); continue; }
    console.log(`  ${c.sz}b [${c.status}] ${c.url}`);
    console.log("    =>", c.snippet.slice(0, 150));
  }
}
