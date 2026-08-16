import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { cancelMarketOnchain } from "@/lib/server/settlement";

export const runtime = "nodejs";

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const m = await prisma.market.findUnique({ where: { id } });
    if (!m) return fail("NotFound", "Market not found", 404);
    if (m.status === "SETTLED" || m.status === "CANCELLED") {
      return fail("Conflict", `Market is already ${m.status.toLowerCase()}`, 409);
    }

    const { cancelTxHash } = await cancelMarketOnchain(id);
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: "market.cancel", target: id, details: { cancelTxHash } },
    });

    return ok({ market: await MarketsRepo.byId(id) });
  },
);
