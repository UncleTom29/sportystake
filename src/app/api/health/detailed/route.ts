import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  const liveMarkets = s.markets.filter((m) => m.status === "LIVE").length;
  return ok({
    components: {
      api:        { status: "ok" },
      database:   { status: "ok", note: "in-memory store" },
      redis:      { status: s.bootstrapped ? "ok" : "degraded" },
      oracle:     { status: s.quota.mode === "emergency" ? "degraded" : "ok", quotaMode: s.quota.mode, lastSync: new Date().toISOString() },
      blockchain: { status: "ok", note: "simulated" },
      queue:      { status: "ok", depth: 0 },
    },
    metrics: {
      liveMarkets,
      openCrashRound: s.currentCrash.id,
      apiFootballRemaining: s.quota.remaining,
    },
  });
});
