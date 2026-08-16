/**
 * Deep probe for Melbet, BetWinner, 22Bet, 1xBet via Playwright
 */
import { chromium } from "playwright";

async function probeProvider(name, url, waitMs = 8000) {
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
      const status = r.status();
      if (status >= 400) return;
      // Skip tracking/analytics/translations
      if (
        u.includes("analytics") ||
        u.includes("hotjar") ||
        u.includes("gtm") ||
        u.includes("sentry") ||
        u.includes("dictionary") ||
        u.includes("media_asset") ||
        u.includes("genfiles/cms") ||
        u.includes("favicons")
      )
        return;
      try {
        const body = await r.json();
        const sz = JSON.stringify(body).length;
        if (sz < 200) return;
        const snippet = JSON.stringify(body).slice(0, 400);
        calls.push({ url: u.slice(0, 150), status, sz, snippet });
      } catch {}
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(waitMs);
    await page.mouse.wheel(0, 800);
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
  { name: "Melbet", url: "https://melbet.com/en/sport/Football" },
  { name: "BetWinner", url: "https://betwinner.ng/en/sport/Football" },
  { name: "22Bet", url: "https://22bet.com/en/sport/Football" },
  { name: "1xBet", url: "https://1xbet.com/en/line/football", waitMs: 12000 },
];

for (const p of providers) {
  console.log(`\n===== ${p.name} =====`);
  const calls = await probeProvider(p.name, p.url, p.waitMs || 8000);
  if (!calls.length) {
    console.log("  No API calls captured");
    continue;
  }
  for (const c of calls.slice(0, 10)) {
    if (c.error) { console.log("  ERROR:", c.error); continue; }
    console.log(`  ${c.sz}b [${c.status}] ${c.url}`);
    console.log("    sample:", c.snippet.slice(0, 200));
  }
}
