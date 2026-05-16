import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const m = store().markets.find((x) => x.id === id);
  if (!m) return fail("NotFound", "Market not found", 404);
  m.status = m.status === "SUSPENDED" ? "OPEN" : "SUSPENDED";
  publish("market:update", { marketId: m.id, status: m.status });
  return ok({ market: m });
});
