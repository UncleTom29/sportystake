import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store, computeUserStats } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const s = store();
  const items = s.users.map((u) => ({ user: u, stats: computeUserStats(u.id) }));
  return ok({ items });
});
