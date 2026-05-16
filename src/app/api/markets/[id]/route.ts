import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const s = store();
  const m = s.markets.find((x) => x.id === id || x.externalId === id);
  if (!m) return fail("NotFound", "Market not found", 404);
  return ok(m);
});
