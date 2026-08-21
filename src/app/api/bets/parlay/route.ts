import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";
import { verifyParlayPlaced } from "@/lib/server/betVerification";

export const runtime = "nodejs";

const Leg = z.object({
  marketId: z.string().min(1).max(80),
  selectionLabel: z.string().min(1).max(80),
  marketType: z.string().min(1).max(40).optional(),
  oddsX1000: z.number().int().positive().max(1_000_000).optional(),
});

const Body = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  // Display metadata only (selectionLabel per leg) — the chain is the
  // source of truth for marketIds/outcomes/stake/odds. Order must match
  // the order the legs were submitted on-chain.
  legs: z.array(Leg).min(2).max(10),
  isPublic: z.boolean().default(true),
});

/**
 * Same trust model as `/api/bets`: the parlay is already placed and
 * confirmed on-chain (one `placeParlayBet` signature covers every leg) by
 * the time this route is called. This just verifies the receipt and
 * persists it — marketIds/outcomes/stake/combinedOdds all come from the
 * decoded `ParlayPlaced` event, never from client-supplied values.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to place a parlay", 401);

  const rl = await rateLimit(`parlay:${auth.sub}`, 30, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Slow down", 429, { details: { retryAfterMs: rl.retryAfterMs } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid parlay payload", 400, { details: parsed.error.issues });
  }
  const body = parsed.data;

  const verified = await verifyParlayPlaced(body.txHash as `0x${string}`, auth.addr);
  if (verified.marketIds.length !== body.legs.length) {
    throw new ApiError("LegCountMismatch", "Submitted legs don't match the on-chain parlay", 400);
  }

  const markets = await prisma.market.findMany({ where: { id: { in: verified.marketIds } } });
  const byId = new Map(markets.map((m) => [m.id, m]));
  for (const marketId of verified.marketIds) {
    if (!byId.has(marketId)) throw new ApiError("NotFound", `Market ${marketId} not found`, 404);
  }

  const { createBookingCodeForSelections } = await import("@/lib/server/bookingCode");
  let bookingCode: string | undefined;
  try {
    bookingCode = await createBookingCodeForSelections({
      selections: verified.marketIds.map((marketId, i) => {
        const m = byId.get(marketId)!;
        return {
          matchId: marketId,
          matchLabel: `${m.homeTeam} vs ${m.awayTeam}`,
          market: body.legs[i].marketType ?? "1X2",
          selection: body.legs[i].selectionLabel,
          odds: (body.legs[i].oddsX1000 ?? 1000) / 1000,
          stake: Number(verified.stake) / 1e6,
        };
      }),
      createdById: auth.sub,
    });
  } catch (err) {
    // Non-blocking
  }

  const parlay = await prisma.parlay.create({
    data: {
      id: verified.parlayId,
      userId: auth.sub,
      stake: verified.stake,
      combinedOddsX1000: verified.combinedOddsX1000,
      potentialPayout: verified.potentialPayout,
      txHash: body.txHash,
      bookingCode,
      legs: {
        create: verified.marketIds.map((marketId, i) => ({
          marketId,
          outcome: verified.outcomes[i],
          selectionLabel: body.legs[i].selectionLabel,
          marketType: body.legs[i].marketType,
          oddsX1000: body.legs[i].oddsX1000 ?? 0,
        })),
      },
    },
    include: { legs: { include: { market: true } } },
  });

  publish("bet:confirmed", { parlayId: parlay.id, userId: parlay.userId });

  return ok({
    parlay: {
      id: parlay.id,
      userId: parlay.userId,
      totalStake: usdcToString(parlay.stake),
      combinedOddsX1000: Number(parlay.combinedOddsX1000),
      potentialPayout: usdcToString(parlay.potentialPayout),
      status: parlay.status,
      bookingCode: parlay.bookingCode ?? undefined,
      createdAt: parlay.placedAt.toISOString(),
      legs: parlay.legs.map((l) => ({
        id: l.id,
        marketId: l.marketId,
        marketLabel: `${l.market.homeTeam} vs ${l.market.awayTeam}`,
        marketType: l.marketType,
        outcome: l.outcome,
        selectionLabel: l.selectionLabel,
        oddsX1000: l.oddsX1000,
        result: l.result,
      })),
    },
  });
});
