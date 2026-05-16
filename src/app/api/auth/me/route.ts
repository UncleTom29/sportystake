import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { store, computeUserStats } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Not signed in", 401);
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) return fail("Unauthorized", "User not found", 401);
  return ok({ user, stats: computeUserStats(user.id) });
});
