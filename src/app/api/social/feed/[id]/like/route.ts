import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const POST = withRequestId(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const item = store().feed.find((f) => f.id === id);
  if (!item) return fail("NotFound", "Feed item not found", 404);
  item.likes++;
  return ok({ likes: item.likes });
});
