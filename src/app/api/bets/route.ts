export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { BetsRepo, usdcToString } from "@/lib/server/repos/bets.repo";
import { verifyBetPlaced } from "@/lib/server/betVerification";
import { evaluateFirstWagerForBonus } from "@/lib/server/bonusEngine";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const Body = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  marketType: z.string().min(1).max(40),
  selectionLabel: z.string().min(1).max(80),
  isLive: z.boolean().default(false),
  isPublic: z.boolean().default(true),
});

/**
 * The bet was already placed and confirmed on-chain by the time this route
 * is called — the client signed `BettingCore.placeBet` via Circle before
 * ever hitting this endpoint. This route's job is purely to verify the
 * receipt (never trust a client-supplied betId/amount/outcome) and persist
 * the confirmed record. `marketType`/`selectionLabel` are display metadata
 * only, not verified on-chain — the chain only knows marketId + an outcome
 * index, not a human-readable label.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to place a bet", 401);

  const rl = await rateLimit(`bets:${auth.sub}`, 30, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Slow down", 429, { details: { retryAfterMs: rl.retryAfterMs } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid bet payload", 400, { details: parsed.error.issues });
  }
  const body = parsed.data;

  const verified = await verifyBetPlaced(body.txHash as `0x${string}`, auth.addr);

  const market = await prisma.market.findUnique({ where: { id: verified.marketId } });
  if (!market) throw new ApiError("NotFound", "Market not found", 404);

  const bet = await BetsRepo.create({
    id: verified.betId,
    userId: auth.sub,
    marketId: verified.marketId,
    marketType: body.marketType,
    outcome: verified.outcome,
    selectionLabel: body.selectionLabel,
    amount: verified.amount,
    oddsX1000: Number(verified.oddsX1000),
    potentialPayout: verified.potentialPayout,
    isLive: body.isLive,
    isPublic: body.isPublic,
    txHash: body.txHash,
  });

  publish("bet:confirmed", { betId: bet.id, userId: bet.userId });

  // Evaluate Welcome Bonus match qualification on first on-chain wager
  evaluateFirstWagerForBonus({
    userId: auth.sub,
    wagerAmountBaseUnits: verified.amount,
    totalOddsX1000: Number(verified.oddsX1000),
    legs: [{ oddsX1000: Number(verified.oddsX1000) }],
  }).catch((err) => {
    logger.warn("[api/bets] Bonus evaluation error", { error: (err as Error).message });
  });

  return ok({ bet });
});

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const status = req.nextUrl.searchParams.get("status") as
    | "PENDING" | "WON" | "LOST" | "CANCELLED" | "CLAIMED" | null;
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 30));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const { items, total } = await BetsRepo.listForUser(auth.sub, {
    ...(status ? { status } : {}),
    limit,
    offset,
  });
  return ok({ items, total, nextOffset: offset + items.length < total ? offset + items.length : null }, undefined);
});
// usdcToString re-exported so other route files can keep one import line.
export { usdcToString };
