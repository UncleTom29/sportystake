import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

const Body = z.object({ winningOutcome: z.number().int().min(0).max(10) });

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "winningOutcome required", 400);
  const s = store();
  const m = s.markets.find((x) => x.id === id);
  if (!m) return fail("NotFound", "Market not found", 404);
  m.status = "SETTLED";
  m.winningOutcome = parsed.data.winningOutcome;
  for (const b of s.bets) {
    if (b.marketId !== m.id || b.status !== "PENDING") continue;
    b.status = b.outcome === parsed.data.winningOutcome ? "WON" : "LOST";
    b.settledAt = new Date().toISOString();
  }
  publish("market:finished", { marketId: m.id });
  return ok({ market: m });
});
