import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { readAuthFromRequest, checkRateLimit } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { shortId } from "@/lib/uid";
import type { LPPositionDTO } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  marketId: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  checkRateLimit(`lp:${auth.sub}`, 10, 60_000);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) throw new ApiError("Unauthorized", "User not found", 401);
  const mkt = s.markets.find((m) => m.id === parsed.data.marketId);
  if (!mkt) throw new ApiError("NotFound", "Market not found", 404);
  if (mkt.status !== "OPEN") throw new ApiError("MarketClosed", "Market not accepting deposits", 409);

  const amount = utils.fromUsdc(parsed.data.amount);
  if (amount < 10n * utils.USDC_SCALE) throw new ApiError("BelowMinimum", "Minimum deposit 10 USDC", 400);

  let pos = s.lpPositions.find((p) => p.userId === user.id && p.marketId === mkt.id && p.status === "ACTIVE");
  if (pos) {
    pos.depositedUsdc = utils.toUsdc(utils.fromUsdc(pos.depositedUsdc) + amount);
    pos.currentValueUsdc = pos.depositedUsdc;
    pos.onchainShares = pos.depositedUsdc;
  } else {
    pos = {
      id: `lp-${shortId()}`,
      userId: user.id,
      userAddress: user.walletAddress,
      marketId: mkt.id,
      marketLabel: `${mkt.homeTeam} vs ${mkt.awayTeam}`,
      onchainShares: amount.toString(),
      depositedUsdc: parsed.data.amount,
      currentValueUsdc: parsed.data.amount,
      status: "ACTIVE",
      txHash: `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`,
      createdAt: new Date().toISOString(),
    } as LPPositionDTO;
    s.lpPositions.push(pos);
  }

  mkt.poolTvl = utils.toUsdc(utils.fromUsdc(mkt.poolTvl) + amount);
  publish("lp:deposit", { marketId: mkt.id, userId: user.id, amount: parsed.data.amount });
  return ok({ position: pos });
});
