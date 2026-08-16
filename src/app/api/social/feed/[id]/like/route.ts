import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * "Like" a public bet. Uses an AuditLog row with action="bet.like" + the
 * bet id as target — light-weight without adding a dedicated Like table.
 * Duplicate-protection via a Postgres unique check on (actorId, action, target).
 *
 * Returns the new like count from the same table.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);
    const { id } = await ctx.params;

    const bet = await prisma.bet.findUnique({ where: { id }, select: { id: true, isPublic: true } });
    if (!bet || !bet.isPublic) return fail("NotFound", "Bet not found", 404);

    // Best-effort dedupe: don't create a 2nd like row per (user, bet).
    const existing = await prisma.auditLog.findFirst({
      where: { actorId: auth.sub, action: "bet.like", target: id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.auditLog.create({
        data: { actorId: auth.sub, action: "bet.like", target: id },
      });
    }

    const likes = await prisma.auditLog.count({
      where: { action: "bet.like", target: id },
    });
    return ok({ likes });
  },
);
