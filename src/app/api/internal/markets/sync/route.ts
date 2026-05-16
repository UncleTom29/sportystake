import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import type { MarketDTO } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const body = (await req.json()) as { markets: MarketDTO[] };
  const s = store();
  for (const incoming of body.markets ?? []) {
    const existing = s.markets.find((m) => m.externalId === incoming.externalId);
    if (existing) Object.assign(existing, incoming);
    else s.markets.push(incoming);
    publish("market:update", { marketId: incoming.id });
  }
  return ok({ count: body.markets?.length ?? 0 });
});
