import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

const Body = z.object({ maxBetUsdc: z.string().regex(/^\d+(\.\d{1,6})?$/) });

/**
 * Per-market max-bet override. Stored in Market.metadata as
 * `{ maxBetUsdc: "<decimal-string>" }`. Read by POST /api/bets at bet-place
 * time to clamp the global 10,000 USDC cap.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("ValidationError", "maxBetUsdc required", 400);

    const market = await prisma.market.findUnique({
      where: { id }, select: { metadata: true },
    });
    if (!market) return fail("NotFound", "Market not found", 404);

    const existing = (market.metadata && typeof market.metadata === "object" && !Array.isArray(market.metadata))
      ? (market.metadata as Record<string, unknown>)
      : {};
    const nextMeta = { ...existing, maxBetUsdc: parsed.data.maxBetUsdc };

    await prisma.$transaction([
      prisma.market.update({ where: { id }, data: { metadata: nextMeta } }),
      prisma.auditLog.create({
        data: {
          actorId: admin.id, action: "market.adjust-max-bet", target: id,
          details: { maxBetUsdc: parsed.data.maxBetUsdc },
        },
      }),
    ]);

    return ok({ market: { id, maxBetUsdc: parsed.data.maxBetUsdc } });
  },
);
