import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { LpRepo } from "@/lib/server/repos/lp.repo";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";
import { verifyWithdrawalExecuted } from "@/lib/server/liquidityVerification";

export const runtime = "nodejs";

const Body = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

const TIMELOCK_MS = 48 * 60 * 60 * 1000;

/**
 * The client already signed and confirmed `LiquidityPool.executeWithdrawal()`
 * via Circle. Verifies the `WithdrawalExecuted` event — `usdcOut` there is
 * the real, final payout, not a cached DB estimate.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);

  const row = await prisma.lpPosition.findUnique({ where: { userId: auth.sub } });
  if (!row) return fail("NotFound", "No position", 404);
  if (row.status !== "WITHDRAW_REQUESTED" || !row.withdrawalRequestedAt) {
    return fail("InvalidState", "Request withdrawal first", 409);
  }
  if (Date.now() - row.withdrawalRequestedAt.getTime() < TIMELOCK_MS) {
    return fail("Timelock", "Withdrawal timelock not yet elapsed", 409);
  }

  const verified = await verifyWithdrawalExecuted(parsed.data.txHash as `0x${string}`, auth.addr);

  const position = await LpRepo.executeWithdraw(row.id, parsed.data.txHash);
  return ok({ position, payoutUsdc: usdcToString(verified.usdcOut) });
});
