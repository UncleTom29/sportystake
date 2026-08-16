import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireInternalKey } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { redisPublisher } from "@/lib/server/redis";

export const runtime = "nodejs";

interface OddsBundle {
  marketType: string;
  selections: { outcome: number; label: string; valueX1000: number }[];
}

/**
 * Manual odds push. Forwards onto the `odds:update` Redis channel so the
 * oracle-sync worker writes new OddsSnapshot rows.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const body = (await req.json()) as { marketId: string; odds: OddsBundle[] };
  const market = body.marketId.startsWith("0x")
    ? await prisma.market.findUnique({ where: { id: body.marketId }, select: { fixtureId: true } })
    : await prisma.market.findUnique({ where: { externalId: body.marketId }, select: { fixtureId: true } });
  if (!market) return ok({ skipped: true, reason: "market not found" });

  await redisPublisher().publish("odds:update", JSON.stringify({
    type: "odds:updated",
    fixtureId: Number(market.fixtureId),
    markets: body.odds.map((b) => ({
      market: b.marketType,
      outcomes: b.selections.map((s) => ({
        key: String(s.outcome),
        label: s.label,
        decimal: s.valueX1000 / 1000,
        valueX1000: s.valueX1000,
      })),
    })),
    ts: new Date().toISOString(),
  }));
  return ok({ updated: true });
});
