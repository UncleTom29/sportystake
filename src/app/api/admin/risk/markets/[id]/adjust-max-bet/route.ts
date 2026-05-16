import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

const Body = z.object({ maxBetUsdc: z.string() });

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "maxBetUsdc required", 400);
  const m = store().markets.find((x) => x.id === id);
  if (!m) return fail("NotFound", "Market not found", 404);
  // Stored on the market object for per-market max bet override
  (m as unknown as { maxBetUsdc?: string }).maxBetUsdc = parsed.data.maxBetUsdc;
  return ok({ market: m });
});
