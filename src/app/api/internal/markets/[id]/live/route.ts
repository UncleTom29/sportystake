import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireInternalKey(req);
  const { id } = await ctx.params;
  const body = (await req.json()) as { homeScore?: number; awayScore?: number; minute?: number; status?: string };
  const m = store().markets.find((x) => x.externalId === id || x.id === id);
  if (!m) return ok({ skipped: true });
  if (body.homeScore !== undefined) m.homeScore = body.homeScore;
  if (body.awayScore !== undefined) m.awayScore = body.awayScore;
  if (body.minute !== undefined) m.liveMinute = body.minute;
  if (body.status === "LIVE") m.status = "LIVE";
  publish("market:live", { marketId: m.id, homeScore: m.homeScore, awayScore: m.awayScore, minute: m.liveMinute });
  return ok({ updated: true });
});
