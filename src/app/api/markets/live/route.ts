import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const items = s.markets.filter((m) => m.status === "LIVE")
    .sort((a, b) => (b.liveMinute ?? 0) - (a.liveMinute ?? 0));
  return ok({ items, total: items.length });
});
