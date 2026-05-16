import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const cutoff = Date.now() + 48 * 3600_000;
  const items = s.markets
    .filter((m) => m.status === "OPEN" && new Date(m.startTime).getTime() <= cutoff)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return ok({ items, total: items.length });
});
