import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);
    const { userId } = await ctx.params;
    if (userId === auth.sub) return fail("BadRequest", "Cannot follow yourself", 400);

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return fail("NotFound", "User not found", 404);

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: auth.sub, followingId: userId } },
      update: {},
      create: { followerId: auth.sub, followingId: userId },
    });
    return ok({ following: true });
  },
);

export const DELETE = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);
    const { userId } = await ctx.params;
    await prisma.follow.deleteMany({
      where: { followerId: auth.sub, followingId: userId },
    });
    return ok({ following: false });
  },
);
