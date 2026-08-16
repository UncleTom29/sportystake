import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Proxies the oracle's `/status` quota field. Cached for ~1s by the browser. */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 2000);
    const res = await fetch(`${serverEnv.ORACLE_INTERNAL_API_URL.replace(/\/$/, "")}/status`, {
      headers: { "x-oracle-key": serverEnv.ORACLE_INTERNAL_API_KEY },
      signal: ctl.signal,
    }).finally(() => clearTimeout(to));
    if (!res.ok) return fail("OracleUnavailable", "Oracle returned non-2xx", 502);
    const json = (await res.json()) as { quota: unknown };
    return ok(json.quota, { headers: { "Cache-Control": "private, max-age=1" } });
  } catch (err) {
    return fail("OracleUnavailable", (err as Error).message ?? "Oracle unreachable", 502);
  }
});
