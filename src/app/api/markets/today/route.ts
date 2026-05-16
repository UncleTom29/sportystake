import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  const items = s.markets
    .filter((m) => new Date(m.startTime).getTime() <= todayEnd.getTime() && m.status !== "SETTLED" && m.status !== "CANCELLED")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return ok({ items, total: items.length });
});
