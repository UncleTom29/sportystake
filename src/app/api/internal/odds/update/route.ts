import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import type { OddsBundle } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const body = (await req.json()) as { marketId: string; odds: OddsBundle[] };
  const m = store().markets.find((x) => x.externalId === body.marketId || x.id === body.marketId);
  if (!m) return ok({ skipped: true });
  m.odds = body.odds;
  publish("odds:update", { marketId: m.id, odds: m.odds });
  return ok({ updated: true });
});
