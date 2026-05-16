import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const PATCH = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const s = store();
  const m = s.markets.find((x) => x.id === id);
  if (!m) return fail("NotFound", "Market not found", 404);
  m.isFeatured = !m.isFeatured;
  return ok({ market: m });
});
