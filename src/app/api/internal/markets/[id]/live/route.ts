import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireInternalKey } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { redisPublisher } from "@/lib/server/redis";

export const runtime = "nodejs";

/**
 * Manual override for live-fixture score / minute. Publishes the same
 * `market:live` channel the oracle uses; the worker picks it up and
 * persists to Postgres.
 */
export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    requireInternalKey(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      homeScore?: number; awayScore?: number; minute?: number; status?: string;
    };
    // The Redis worker keys events by fixtureId — accept either Postgres
    // marketId (bytes32 hex) or externalId ("oddsapi:1234567").
    const market = id.startsWith("0x")
      ? await prisma.market.findUnique({ where: { id }, select: { fixtureId: true } })
      : await prisma.market.findUnique({ where: { externalId: id }, select: { fixtureId: true } });
    if (!market) return ok({ skipped: true, reason: "market not found" });

    await redisPublisher().publish("market:live", JSON.stringify({
      type: "market:live",
      fixtureId: Number(market.fixtureId),
      minute: body.minute ?? null,
      score: { home: body.homeScore ?? 0, away: body.awayScore ?? 0 },
      ts: new Date().toISOString(),
    }));
    return ok({ updated: true });
  },
);
