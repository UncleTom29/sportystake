import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const s = store();
  return ok({ items: s.crashHistory.slice(0, 50).map((r) => ({ id: r.id, crashMultiplierX100: r.crashMultiplierX100, at: r.startedAt })) });
});
