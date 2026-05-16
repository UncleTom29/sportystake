import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

const Body = z.object({ marketId: z.string() });

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);
  const s = store();
  const pos = s.lpPositions.find((p) => p.userId === auth.sub && p.marketId === parsed.data.marketId);
  if (!pos) return fail("NotFound", "No position", 404);
  const mkt = s.markets.find((m) => m.id === pos.marketId);
  const settled = mkt?.status === "SETTLED" || pos.status === "SETTLED";
  if (!settled && pos.status !== "WITHDRAWAL_REQUESTED") {
    return fail("InvalidState", "Request withdrawal first or wait for market settlement", 409);
  }
  const final = pos.finalUsdc ?? pos.currentValueUsdc ?? pos.depositedUsdc;
  pos.status = "SETTLED";
  pos.settledAt = new Date().toISOString();
  pos.finalUsdc = final;
  if (mkt) {
    mkt.poolTvl = utils.toUsdc(
      utils.fromUsdc(mkt.poolTvl) - utils.fromUsdc(final) > 0n
        ? utils.fromUsdc(mkt.poolTvl) - utils.fromUsdc(final)
        : 0n,
    );
  }
  return ok({ position: pos, payoutUsdc: final });
});
