import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  return ok({
    status: "ok",
    timestamp: new Date().toISOString(),
    counts: {
      users: s.users.length,
      markets: s.markets.length,
      bets: s.bets.length,
      lpPositions: s.lpPositions.length,
    },
    quota: s.quota,
  });
});
