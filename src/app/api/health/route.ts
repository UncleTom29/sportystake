import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Shallow health check. Returns 200 with table counts + oracle quota even if
 * the oracle is unreachable (callers like `/api/health/detailed` do the deep
 * check). Used by k8s liveness probes — must be cheap.
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  const [users, markets, bets, lpPositions] = await Promise.all([
    prisma.user.count(),
    prisma.market.count(),
    prisma.bet.count(),
    prisma.lpPosition.count(),
  ]);

  let quota: unknown = null;
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${serverEnv.ORACLE_INTERNAL_API_URL.replace(/\/$/, "")}/status`, {
      headers: { "x-oracle-key": serverEnv.ORACLE_INTERNAL_API_KEY },
      signal: ctl.signal,
    }).finally(() => clearTimeout(to));
    if (res.ok) quota = ((await res.json()) as { quota?: unknown }).quota;
  } catch { /* oracle down — leave quota null */ }

  return ok({
    status: "ok",
    timestamp: new Date().toISOString(),
    counts: { users, markets, bets, lpPositions },
    quota,
  });
});
