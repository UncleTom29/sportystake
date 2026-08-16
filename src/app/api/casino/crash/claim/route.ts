import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { verifyPayoutClaimed } from "@/lib/server/crashVerification";
import { utils as casinoUtils } from "@/lib/server/casino";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * `CrashGame.claim()` is a separate pull-payment step (didn't exist as a
 * route before — the old mock engine paid out implicitly). The client
 * signs and confirms it via Circle first; this just verifies the
 * `PayoutClaimed` receipt for the activity feed.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

  const verified = await verifyPayoutClaimed(parsed.data.txHash as `0x${string}`, auth.addr);
  return ok({ amount: casinoUtils.usdcToString(verified.amount) });
});
