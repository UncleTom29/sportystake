import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const s = store();
  const items = s.lpPositions.filter((p) => p.userId === auth.sub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok({ items, total: items.length });
});
