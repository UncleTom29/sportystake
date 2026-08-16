import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { UsersRepo } from "@/lib/server/repos/users.repo";

export const runtime = "nodejs";

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return fail("NotFound", "User not found", 404);
    const user = await UsersRepo.setBanned(id, false);
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: "user.unban", target: id },
    });
    return ok({ user });
  },
);
