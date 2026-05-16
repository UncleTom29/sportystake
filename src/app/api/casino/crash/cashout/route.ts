import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) return fail("NotFound", "User not found", 404);
  const r = s.currentCrash;
  if (r.status !== "running") return fail("InvalidState", "No active round", 409);
  const me = r.players.find((p) => p.address.toLowerCase() === user.walletAddress.toLowerCase());
  if (!me) return fail("NotJoined", "You did not join this round", 409);
  if (me.cashedOutAtX100) return fail("AlreadyCashedOut", "Already cashed out", 409);
  me.cashedOutAtX100 = r.multiplierX100 ?? 100;
  publish("crash:state", r);
  return ok({ round: r, cashedOutAtX100: me.cashedOutAtX100 });
});
