import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { UsersRepo } from "@/lib/server/repos/users.repo";
import { revokeAllRefreshTokens } from "@/lib/server/auth-store";

export const runtime = "nodejs";

const Body = z.object({ reason: z.string().max(500).optional() });

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return fail("NotFound", "User not found", 404);

    const body = Body.safeParse(await req.json().catch(() => ({})));
    const reason = body.success ? body.data.reason : undefined;

    const user = await UsersRepo.setBanned(id, true, reason);
    await Promise.all([
      revokeAllRefreshTokens(id),
      prisma.auditLog.create({
        data: { actorId: admin.id, action: "user.ban", target: id, details: { reason: reason ?? null } },
      }),
    ]);
    return ok({ user });
  },
);
