import { chromium } from "playwright";

const br = await chromium.launch({ headless: true });
const ctx = await br.newContext({ locale: "en-US" });
const page = await ctx.newPage();
const calls = [];

page.on("response", async (r) => {
  const url = r.url();
  if (!url.includes("api.betika.com") && !url.includes("cdn.betika")) return;
  const ct = r.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const b = await r.json();
    const sz = JSON.stringify(b).length;
    if (sz > 300) calls.push({ url: url.slice(0, 120), keys: Object.keys(b).slice(0, 5), sz });
  } catch {}
});

await page.goto("https://www.betika.com/en-gb/s/?sport=Soccer", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(6000);

// Try to scroll or interact
await page.mouse.wheel(0, 400);
await page.waitForTimeout(2000);

for (const c of calls) console.log(c.sz + "b " + c.url + " keys:" + c.keys.join(","));

await br.close();
