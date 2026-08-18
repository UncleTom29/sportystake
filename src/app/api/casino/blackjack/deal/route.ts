import { NextRequest } from "next/server";
import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/server/db";
import { generateServerSeed, hashServerSeed } from "@/lib/server/provably-fair";
import { verifyCasinoBetPlaced } from "@/lib/server/casinoVerification";
import { dealInitial, isNaturalBlackjack } from "@/lib/server/blackjackEngine";
import { finishBlackjackHand } from "@/lib/server/blackjackResolution";
import { utils as casinoUtils } from "@/lib/server/casino";

export const runtime = "nodejs";

const Body = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  clientSeed: z.string().min(1).max(64).default("default"),
});

/** Solidity CasinoHouse.GameType enum order — Dice=0, Slots=1, Blackjack=2, Roulette=3, Baccarat=4. */
const BLACKJACK_ONCHAIN_TYPE = 2;

/**
 * Deals a new blackjack hand. The client already signed and confirmed
 * `CasinoHouse.placeCasinoBet(amount, Blackjack, clientSeedHash)`.
 *
 * A natural (2-card) blackjack has no hit/stand decision to make — this
 * route resolves it immediately via the same `finishBlackjackHand` path
 * `/api/casino/blackjack/action` uses for stand/bust, so there's exactly
 * one place that plays the dealer out, applies the bonus-gating check, and
 * settles on-chain.
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

  const verified = await verifyCasinoBetPlaced(body.txHash as `0x${string}`, auth.addr);
  if (verified.game !== BLACKJACK_ONCHAIN_TYPE) {
    throw new ApiError("GameMismatch", "Transaction was for a different game", 400);
  }
  const expectedSeedHash = keccak256(toBytes(body.clientSeed));
  if (verified.clientSeed.toLowerCase() !== expectedSeedHash.toLowerCase()) {
    throw new ApiError("SeedMismatch", "Client seed doesn't match the committed on-chain value", 400);
  }

  // Idempotency: a page refresh or a retried request should resume the
  // existing hand, never deal a fresh one against an already-confirmed stake.
  const existingBet = await prisma.casinoBet.findFirst({
    where: { requestId: verified.requestId },
    include: { blackjackHand: true },
  });
  if (existingBet?.blackjackHand) {
    return ok(handToResponse(existingBet, existingBet.blackjackHand));
  }

  const nonce = await prisma.casinoBet.count({ where: { userId: auth.sub, game: "BLACKJACK" } });
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const { playerCards, dealerCards, cursor } = dealInitial(serverSeed, body.clientSeed, nonce);

  const { casinoBet, blackjackHand } = await prisma.$transaction(async (tx) => {
    const casinoBet = await tx.casinoBet.create({
      data: {
        userId: auth.sub,
        game: "BLACKJACK",
        amount: verified.amount,
        status: "PENDING",
        requestId: verified.requestId,
        seedServerHash: serverSeedHash,
        seedClient: body.clientSeed,
        seedServer: serverSeed,
        nonce,
        txHash: body.txHash,
      },
    });
    const blackjackHand = await tx.blackjackHand.create({
      data: {
        casinoBetId: casinoBet.id,
        cursor,
        playerHands: [{ cards: playerCards, done: false }],
        dealerHand: { cards: dealerCards },
        status: "player_turn",
      },
    });
    return { casinoBet, blackjackHand };
  });

  if (isNaturalBlackjack(playerCards)) {
    const finished = await finishBlackjackHand({
      blackjackHandId: blackjackHand.id,
      casinoBetId: casinoBet.id,
      requestId: verified.requestId,
      serverSeed,
      clientSeed: body.clientSeed,
      nonce,
      stake: verified.amount,
      playerCards,
      dealerCards,
      cursor,
      playerBusted: false,
      fallbackTxHash: body.txHash,
    });
    return ok({
      casinoBetId: casinoBet.id,
      actionSeq: blackjackHand.actionSeq,
      status: "resolved",
      playerHands: [{ cards: playerCards, done: true }],
      dealerCards: finished.dealerCards,
      outcome: finished.outcome,
      multiplier: finished.multiplier,
      bonusGated: finished.bonusGated,
      payout: casinoUtils.usdcToString(finished.payoutUsdc),
      win: finished.win,
      fairness: { serverSeedHash, serverSeed, clientSeed: body.clientSeed, nonce },
    });
  }

  return ok({
    casinoBetId: casinoBet.id,
    actionSeq: blackjackHand.actionSeq,
    status: "player_turn",
    playerHands: [{ cards: playerCards, done: false }],
    dealerUpCard: dealerCards[0], // hole card withheld until resolution
    fairness: { serverSeedHash, clientSeed: body.clientSeed, nonce },
  });
});

function handToResponse(
  bet: {
    id: string;
    seedServerHash: string | null;
    seedClient: string | null;
    nonce: number;
    status: string;
    payout: bigint;
    multiplierX100: number | null;
    metadata: unknown;
  },
  hand: { actionSeq: number; status: string; playerHands: unknown; dealerHand: unknown },
) {
  const playerHands = hand.playerHands as { cards: number[]; done: boolean }[];
  const dealerHand = hand.dealerHand as { cards: number[] };
  if (hand.status === "resolved") {
    const md = (bet.metadata ?? {}) as { outcome?: string; bonusGated?: boolean };
    return {
      casinoBetId: bet.id,
      actionSeq: hand.actionSeq,
      status: "resolved",
      playerHands,
      dealerCards: dealerHand.cards,
      outcome: md.outcome,
      bonusGated: md.bonusGated ?? false,
      payout: casinoUtils.usdcToString(bet.payout),
      win: bet.status === "WON",
      multiplier: (bet.multiplierX100 ?? 0) / 100,
    };
  }
  return {
    casinoBetId: bet.id,
    actionSeq: hand.actionSeq,
    status: "player_turn",
    playerHands,
    dealerUpCard: dealerHand.cards[0],
    fairness: { serverSeedHash: bet.seedServerHash, clientSeed: bet.seedClient, nonce: bet.nonce },
  };
}
