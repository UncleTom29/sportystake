import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { LpRepo } from "@/lib/server/repos/lp.repo";
import { verifyWithdrawalRequested } from "@/lib/server/liquidityVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

/**
 * The client already signed and confirmed `LiquidityPool.requestWithdrawal()`
 * via Circle — this is itself an on-chain tx (it starts the 48h timelock),
 * not just a DB flag flip. Verifies the `WithdrawalRequested` event.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);

  const existing = await LpRepo.forUser(auth.sub);
  if (!existing) return fail("NotFound", "No active position", 404);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
  }

  await verifyWithdrawalRequested(parsed.data.txHash as `0x${string}`, auth.addr);

  const position = await LpRepo.requestWithdraw(existing.id);
  return ok({ position, timelockHours: 48 });
});
