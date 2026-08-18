import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/server/db";
import { drawCard, isBust } from "@/lib/server/blackjackEngine";
import { finishBlackjackHand } from "@/lib/server/blackjackResolution";
import { utils as casinoUtils } from "@/lib/server/casino";

export const runtime = "nodejs";

const Body = z.object({
  casinoBetId: z.string().min(1),
  action: z.enum(["hit", "stand"]),
  actionSeq: z.number().int().min(0),
});

/**
 * Hit or stand on an in-progress blackjack hand. No on-chain transaction
 * here — the stake was already collected and verified at deal time; this is
 * an off-chain state transition on an already-accepted bet, settled on-chain
 * exactly once, when the hand actually finishes (a bust here, or via
 * `finishBlackjackHand` on stand) — the same shape as `CrashGame.cashOut`
 * being off-chain-recorded while payout only happens once at `resolveRound`.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to play", 401);
  const rl = await rateLimit(`casino:${auth.sub}`, 60, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Slow down", 429, { details: { retryAfterMs: rl.retryAfterMs } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid request", 400, { details: parsed.error.issues });
  }
  const body = parsed.data;

  const casinoBet = await prisma.casinoBet.findUnique({
    where: { id: body.casinoBetId },
    include: { blackjackHand: true },
  });
  if (!casinoBet || !casinoBet.blackjackHand) {
    throw new ApiError("NotFound", "No such hand", 404);
  }
  if (casinoBet.userId !== auth.sub) {
    throw new ApiError("Forbidden", "This hand doesn't belong to you", 403);
  }
  const hand = casinoBet.blackjackHand;

  if (hand.status === "resolved") {
    // Idempotent replay (double-click, retried request) — return the
    // already-settled outcome rather than erroring.
    const md = (casinoBet.metadata ?? {}) as { outcome?: string; bonusGated?: boolean };
    const dealerHand = hand.dealerHand as { cards: number[] };
    return ok({
      casinoBetId: casinoBet.id,
      actionSeq: hand.actionSeq,
      status: "resolved",
      playerHands: hand.playerHands,
      dealerCards: dealerHand.cards,
      outcome: md.outcome,
      bonusGated: md.bonusGated ?? false,
      payout: casinoUtils.usdcToString(casinoBet.payout),
      win: casinoBet.status === "WON",
      multiplier: (casinoBet.multiplierX100 ?? 0) / 100,
    });
  }

  // Atomically claim this hand before doing any work: bumps actionSeq under
  // a WHERE on the client's expected actionSeq AND status="player_turn", so
  // a stale actionSeq (double-click, retried request racing a prior action)
  // or a concurrent claim both fail this update (affected-row count 0)
  // rather than silently double-acting on the same hand.
  const claimed = await prisma.blackjackHand.updateMany({
    where: { id: hand.id, actionSeq: body.actionSeq, status: "player_turn" },
    data: { actionSeq: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new ApiError("Conflict", "Hand state changed — refresh and try again", 409);
  }

  const playerHands = hand.playerHands as { cards: number[]; done: boolean }[];
  const dealerHand = hand.dealerHand as { cards: number[] };
  const playerCards = playerHands[0].cards;
  const nextActionSeq = body.actionSeq + 1;

  if (body.action === "hit") {
    const used = new Set<number>([...playerCards, ...dealerHand.cards]);
    const { card, nextCursor } = drawCard(casinoBet.seedServer!, casinoBet.seedClient!, casinoBet.nonce, used, hand.cursor);
    const newPlayerCards = [...playerCards, card];

    if (isBust(newPlayerCards)) {
      const finished = await finishBlackjackHand({
        blackjackHandId: hand.id,
        casinoBetId: casinoBet.id,
        requestId: casinoBet.requestId as `0x${string}`,
        serverSeed: casinoBet.seedServer!,
        clientSeed: casinoBet.seedClient!,
        nonce: casinoBet.nonce,
        stake: casinoBet.amount,
        playerCards: newPlayerCards,
        dealerCards: dealerHand.cards,
        cursor: nextCursor,
        playerBusted: true,
        fallbackTxHash: casinoBet.txHash ?? "",
      });
      return ok({
        casinoBetId: casinoBet.id,
        actionSeq: nextActionSeq,
        status: "resolved",
        playerHands: [{ cards: newPlayerCards, done: true }],
        dealerCards: finished.dealerCards,
        outcome: finished.outcome,
        multiplier: finished.multiplier,
        bonusGated: finished.bonusGated,
        payout: casinoUtils.usdcToString(finished.payoutUsdc),
        win: finished.win,
      });
    }

    await prisma.blackjackHand.update({
      where: { id: hand.id },
      data: { cursor: nextCursor, playerHands: [{ cards: newPlayerCards, done: false }] },
    });
    return ok({
      casinoBetId: casinoBet.id,
      actionSeq: nextActionSeq,
      status: "player_turn",
      playerHands: [{ cards: newPlayerCards, done: false }],
      dealerUpCard: dealerHand.cards[0],
    });
  }

  // stand
  const finished = await finishBlackjackHand({
    blackjackHandId: hand.id,
    casinoBetId: casinoBet.id,
    requestId: casinoBet.requestId as `0x${string}`,
    serverSeed: casinoBet.seedServer!,
    clientSeed: casinoBet.seedClient!,
    nonce: casinoBet.nonce,
    stake: casinoBet.amount,
    playerCards,
    dealerCards: dealerHand.cards,
    cursor: hand.cursor,
    playerBusted: false,
    fallbackTxHash: casinoBet.txHash ?? "",
  });
  return ok({
    casinoBetId: casinoBet.id,
    actionSeq: nextActionSeq,
    status: "resolved",
    playerHands: [{ cards: playerCards, done: true }],
    dealerCards: finished.dealerCards,
    outcome: finished.outcome,
    multiplier: finished.multiplier,
    bonusGated: finished.bonusGated,
    payout: casinoUtils.usdcToString(finished.payoutUsdc),
    win: finished.win,
  });
});
