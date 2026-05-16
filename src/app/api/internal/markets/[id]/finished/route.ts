import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireInternalKey(req);
  const { id } = await ctx.params;
  const body = (await req.json()) as { homeScore: number; awayScore: number };
  const m = store().markets.find((x) => x.externalId === id || x.id === id);
  if (!m) return ok({ skipped: true });
  m.status = "SETTLED";
  m.homeScore = body.homeScore;
  m.awayScore = body.awayScore;
  m.winningOutcome = body.homeScore > body.awayScore ? 0 : body.homeScore === body.awayScore ? 1 : 2;
  publish("market:finished", { marketId: m.id, homeScore: body.homeScore, awayScore: body.awayScore });
  return ok({ settled: true });
});
