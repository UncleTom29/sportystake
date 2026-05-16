import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const { userId } = await ctx.params;
  if (userId === auth.sub) return fail("BadRequest", "Cannot follow yourself", 400);
  const s = store();
  const target = s.users.find((u) => u.id === userId);
  if (!target) return fail("NotFound", "User not found", 404);
  const exists = s.follows.some((f) => f.followerId === auth.sub && f.followingId === userId);
  if (!exists) s.follows.push({ followerId: auth.sub, followingId: userId, at: Date.now() });
  return ok({ following: true });
});

export const DELETE = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const { userId } = await ctx.params;
  const s = store();
  s.follows = s.follows.filter((f) => !(f.followerId === auth.sub && f.followingId === userId));
  return ok({ following: false });
});
