import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { publish } from "@/lib/server/event-bus";
import { LpRepo } from "@/lib/server/repos/lp.repo";
import { verifyDeposit } from "@/lib/server/liquidityVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * The client already signed and confirmed `LiquidityPool.deposit()` via
 * Circle before calling this. Verifies the `Deposited` event (never trusts
 * a client-supplied amount) and caches the resulting position.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const rl = await rateLimit(`lp:${auth.sub}`, 10, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Slow down", 429, { details: { retryAfterMs: rl.retryAfterMs } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
  }

  const verified = await verifyDeposit(parsed.data.txHash as `0x${string}`, auth.addr);

  const position = await LpRepo.upsert({
    userId: auth.sub,
    onchainShares: verified.sharesMinted,
    depositedUsdc: verified.usdcAmount,
    depositTxHash: parsed.data.txHash,
  });

  publish("lp:deposit", { userId: auth.sub, amount: verified.usdcAmount.toString() });
  return ok({ position });
});
