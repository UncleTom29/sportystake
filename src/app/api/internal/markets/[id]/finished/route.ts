import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireInternalKey } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { redisPublisher } from "@/lib/server/redis";

export const runtime = "nodejs";

/**
 * Manual override for fixture-finished. Triggers both the oracle-sync
 * worker (to flip the market status) and the on-chain settlement worker
 * (to call BettingCore.settleMarket).
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    requireInternalKey(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as { homeScore: number; awayScore: number };
    const market = id.startsWith("0x")
      ? await prisma.market.findUnique({ where: { id }, select: { fixtureId: true } })
      : await prisma.market.findUnique({ where: { externalId: id }, select: { fixtureId: true } });
    if (!market) return ok({ skipped: true, reason: "market not found" });

    await redisPublisher().publish("market:finished", JSON.stringify({
      type: "market:finished",
      fixtureId: Number(market.fixtureId),
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      ts: new Date().toISOString(),
    }));
    return ok({ settled: true });
  },
);
