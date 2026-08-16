import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

export const PATCH = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const m = await prisma.market.findUnique({ where: { id }, select: { isFeatured: true } });
    if (!m) return fail("NotFound", "Market not found", 404);
    await prisma.$transaction([
      prisma.market.update({ where: { id }, data: { isFeatured: !m.isFeatured } }),
      prisma.auditLog.create({
        data: { actorId: admin.id, action: "market.featured-toggle", target: id, details: { to: !m.isFeatured } },
      }),
    ]);
    return ok({ market: await MarketsRepo.byId(id) });
  },
);
