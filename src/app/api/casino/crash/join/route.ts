import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

const Body = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  autoCashoutX100: z.number().int().min(101).max(100000).optional(),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) return fail("NotFound", "User not found", 404);
  const r = s.currentCrash;
  if (r.status !== "waiting") return fail("InvalidState", "Round already running, wait for next", 409);
  if (r.players.some((p) => p.address.toLowerCase() === user.walletAddress.toLowerCase())) {
    return fail("AlreadyJoined", "Already in this round", 409);
  }
  r.players.push({ address: user.walletAddress, amount: parsed.data.amount, autoCashoutX100: parsed.data.autoCashoutX100 });
  publish("crash:state", r);
  return ok({ round: r });
});
