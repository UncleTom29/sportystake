import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  return ok({ round: s.currentCrash, history: s.crashHistory.slice(0, 20).map((r) => r.crashMultiplierX100) });
});
