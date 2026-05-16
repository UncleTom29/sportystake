import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { readAuthFromRequest, checkRateLimit } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { shortId } from "@/lib/uid";
import type { BetDTO, ParlayDTO, MarketType } from "@/lib/types";

export const runtime = "nodejs";

const Leg = z.object({
  marketId: z.string(),
  marketType: z.string(),
  outcome: z.number().int(),
  selectionLabel: z.string(),
  oddsX1000: z.number().int().min(1050).max(50000),
});

const Body = z.object({
  selections: z.array(Leg).min(2).max(20),
  totalStake: z.string().regex(/^\d+(\.\d{1,6})?$/),
  isPublic: z.boolean().default(true),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to place a parlay", 401);
  checkRateLimit(`parlay:${auth.sub}`, 30, 60_000);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid parlay payload", 400, { details: parsed.error.issues });
  const body = parsed.data;
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) throw new ApiError("Unauthorized", "User not found", 401);

  const seenMarkets = new Set<string>();
  let combinedX1000 = 1000;
  const stake = utils.fromUsdc(body.totalStake);
  if (stake < 5n * utils.USDC_SCALE) throw new ApiError("BelowMinimum", "Minimum stake 5 USDC", 400);

  const legs: BetDTO[] = [];
  for (const sel of body.selections) {
    if (seenMarkets.has(sel.marketId)) throw new ApiError("DuplicateLeg", "Each leg must be a different market", 400);
    seenMarkets.add(sel.marketId);
    const mkt = s.markets.find((m) => m.id === sel.marketId);
    if (!mkt) throw new ApiError("NotFound", `Market ${sel.marketId} not found`, 404);
    if (mkt.status !== "OPEN") throw new ApiError("MarketClosed", `Leg ${sel.marketId} is closed`, 409);
    const bundle = mkt.odds.find((o) => o.marketType === (sel.marketType as MarketType));
    if (!bundle) throw new ApiError("InvalidMarketType", "Unknown market type", 400);
    const onchain = bundle.selections.find((x) => x.outcome === sel.outcome);
    if (!onchain) throw new ApiError("InvalidOutcome", "Unknown outcome", 400);
    combinedX1000 = Math.round((combinedX1000 * onchain.valueX1000) / 1000);
    legs.push({
      id: `bet-${shortId()}`,
      userId: user.id,
      userAddress: user.walletAddress,
      marketId: mkt.id,
      marketLabel: `${mkt.homeTeam} vs ${mkt.awayTeam}`,
      marketType: sel.marketType as MarketType,
      outcome: sel.outcome,
      selectionLabel: sel.selectionLabel,
      amount: "0",
      oddsX1000: onchain.valueX1000,
      potentialPayout: "0",
      status: "PENDING",
      isLive: false,
      isPublic: body.isPublic,
      createdAt: new Date().toISOString(),
    });
  }

  const potential = (stake * BigInt(combinedX1000)) / 1000n;
  const parlay: ParlayDTO = {
    id: `parlay-${shortId()}`,
    userId: user.id,
    legs,
    totalStake: body.totalStake,
    combinedOddsX1000: combinedX1000,
    potentialPayout: utils.toUsdc(potential),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  legs.forEach((l) => { l.parlayId = parlay.id; s.bets.unshift(l); });
  s.parlays.unshift(parlay);

  setTimeout(() => publish("bet:confirmed", { parlayId: parlay.id, userId: parlay.userId }), 1500);

  return ok({ parlay });
});
