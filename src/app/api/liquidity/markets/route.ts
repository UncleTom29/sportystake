import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store, getPoolStats } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const cutoff = Date.now() + 30 * 60_000;
  const items = s.markets
    .filter((m) => m.status === "OPEN" && new Date(m.startTime).getTime() > cutoff)
    .map((m) => ({ market: m, pool: getPoolStats(m.id) }))
    .filter((x): x is { market: typeof x.market; pool: NonNullable<typeof x.pool> } => x.pool !== null)
    .sort((a, b) => b.pool.estimatedApy - a.pool.estimatedApy);
  return ok({ items, total: items.length });
});
