import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const u = store().users.find((x) => x.id === id);
  if (!u) return fail("NotFound", "User not found", 404);
  u.isBanned = true;
  return ok({ user: u });
});
