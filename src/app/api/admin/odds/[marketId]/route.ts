import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";

export const runtime = "nodejs";

const Body = z.object({
  markets: z.array(z.object({
    marketType: z.string().min(1).max(40),
    selections: z.array(z.object({
      outcome: z.number().int().min(0).max(10),
      label: z.string().min(1).max(40),
      valueX1000: z.number().int().min(1050).max(50_000),
    })).min(2).max(10),
  })).min(1).max(20),
});

/**
 * Admin override of market odds. Writes a new OddsSnapshot row tagged
 * `bookmaker: "admin-override"` so downstream code that picks the most
 * recent snapshot per (marketId, marketType) sees the override immediately.
 *
 * Does NOT delete previous snapshots — they're kept for audit / odds-history
 * charts.
 */
export const PUT = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ marketId: string }> }) => {
    const admin = await requireAdmin(req);
    const { marketId } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) return fail("NotFound", "Market not found", 404);

    await prisma.$transaction([
      ...parsed.data.markets.map((upd) =>
        prisma.oddsSnapshot.create({
          data: {
            marketId,
            marketType: upd.marketType,
            bookmaker: "admin-override",
            outcomes: upd.selections,
          },
        }),
      ),
      prisma.auditLog.create({
        data: {
          actorId: admin.id, action: "odds.override", target: marketId,
          details: { markets: parsed.data.markets.map((u) => u.marketType) },
        },
      }),
    ]);

    publish("odds:update", { marketId, source: "admin" });
    return ok({ market: await MarketsRepo.byId(marketId) });
  },
);
