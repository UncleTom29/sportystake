import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

const Body = z.object({
  markets: z.array(z.object({
    marketType: z.string(),
    selections: z.array(z.object({ outcome: z.number().int(), label: z.string(), valueX1000: z.number().int().min(1050).max(50000) })),
  })),
});

export const PUT = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ marketId: string }> }) => {
  await requireAdmin(req);
  const { marketId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
  const m = store().markets.find((x) => x.id === marketId);
  if (!m) return fail("NotFound", "Market not found", 404);
  for (const upd of parsed.data.markets) {
    const bundle = m.odds.find((b) => b.marketType === upd.marketType);
    if (!bundle) continue;
    for (const sel of upd.selections) {
      const existing = bundle.selections.find((x) => x.outcome === sel.outcome);
      if (existing) {
        existing.prevValueX1000 = existing.valueX1000;
        existing.valueX1000 = sel.valueX1000;
        existing.label = sel.label;
        existing.movement = sel.valueX1000 > existing.prevValueX1000! ? "up" : sel.valueX1000 < existing.prevValueX1000! ? "down" : "same";
      }
    }
  }
  publish("odds:update", { marketId: m.id, odds: m.odds });
  return ok({ market: m });
});
