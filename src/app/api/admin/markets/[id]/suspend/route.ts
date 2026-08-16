import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

/** Toggle a market between OPEN and SUSPENDED. Idempotent per call. */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const m = await prisma.market.findUnique({ where: { id }, select: { status: true } });
    if (!m) return fail("NotFound", "Market not found", 404);
    const nextStatus = m.status === "SUSPENDED" ? "OPEN" : "SUSPENDED";
    await prisma.$transaction([
      prisma.market.update({ where: { id }, data: { status: nextStatus } }),
      prisma.auditLog.create({
        data: { actorId: admin.id, action: "market.suspend-toggle", target: id, details: { from: m.status, to: nextStatus } },
      }),
    ]);
    publish("market:update", { marketId: id, status: nextStatus });
    return ok({ market: await MarketsRepo.byId(id) });
  },
);
