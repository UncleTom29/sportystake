import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) return fail("NotFound", "User not found", 404);
  const items = s.diceHistory.filter((r) => r.userAddress.toLowerCase() === user.walletAddress.toLowerCase()).slice(0, 50);
  return ok({ items });
});
