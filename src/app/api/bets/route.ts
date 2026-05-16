import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { readAuthFromRequest, checkRateLimit } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { shortId } from "@/lib/uid";
import type { BetDTO, MarketType } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  marketId: z.string().min(1),
  marketType: z.string(),
  outcome: z.number().int().min(0).max(10),
  selectionLabel: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  oddsX1000: z.number().int().min(1050).max(50000),
  slippageToleranceBps: z.number().int().min(0).max(2000).default(50),
  isLive: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  copyOfBetId: z.string().optional(),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to place a bet", 401);
  checkRateLimit(`bets:${auth.sub}`, 30, 60_000);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid bet payload", 400, { details: parsed.error.issues });
  const body = parsed.data;

  const s = store();
  const mkt = s.markets.find((m) => m.id === body.marketId);
  if (!mkt) throw new ApiError("NotFound", "Market not found", 404);
  if (mkt.status !== "OPEN" && mkt.status !== "LIVE") throw new ApiError("MarketClosed", "Market not accepting bets", 409);

  // Slippage check vs current odds
  const bundle = mkt.odds.find((o) => o.marketType === body.marketType as MarketType);
  if (!bundle) throw new ApiError("InvalidMarketType", "Unknown market type", 400);
  const sel = bundle.selections.find((x) => x.outcome === body.outcome);
  if (!sel) throw new ApiError("InvalidOutcome", "Unknown outcome", 400);
  const tolerated = Math.floor(sel.valueX1000 * (1 - body.slippageToleranceBps / 10000));
  if (body.oddsX1000 < tolerated) throw new ApiError("Slippage", "Odds have moved beyond slippage tolerance", 409);

  const amount = utils.fromUsdc(body.amount);
  if (amount < 5n * utils.USDC_SCALE) throw new ApiError("BelowMinimum", "Minimum bet is 5 USDC", 400);
  if (amount > 10000n * utils.USDC_SCALE) throw new ApiError("AboveMaximum", "Maximum bet is 10,000 USDC", 400);

  // Pool liquidity check
  const potential = (amount * BigInt(sel.valueX1000)) / 1000n;
  const tvl = utils.fromUsdc(mkt.poolTvl);
  const locked = utils.fromUsdc(mkt.poolLocked);
  const newLocked = locked + (potential - amount);
  if (newLocked * 10n > tvl * 9n) {
    throw new ApiError("InsufficientPool", "Pool cannot cover this payout right now", 409);
  }

  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) throw new ApiError("Unauthorized", "User not found", 401);

  const bet: BetDTO = {
    id: `bet-${shortId()}`,
    userId: user.id,
    userAddress: user.walletAddress,
    marketId: mkt.id,
    marketLabel: `${mkt.homeTeam} vs ${mkt.awayTeam}`,
    marketType: body.marketType as MarketType,
    outcome: body.outcome,
    selectionLabel: body.selectionLabel,
    amount: body.amount,
    oddsX1000: sel.valueX1000,
    potentialPayout: utils.toUsdc(potential),
    status: "PENDING",
    isLive: !!body.isLive,
    isPublic: body.isPublic,
    txHash: `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`,
    onchainBetId: `0x${shortId()}`,
    createdAt: new Date().toISOString(),
    copyOfBetId: body.copyOfBetId,
  };
  s.bets.unshift(bet);
  mkt.poolLocked = utils.toUsdc(newLocked);
  mkt.poolBetVolume = utils.toUsdc(utils.fromUsdc(mkt.poolBetVolume) + amount);

  // Simulate on-chain confirmation after 1.5s
  setTimeout(() => {
    publish("bet:confirmed", { betId: bet.id, txHash: bet.txHash, userId: bet.userId });
  }, 1500);

  return ok({ bet, estimatedConfirmationMs: 1500 });
});
