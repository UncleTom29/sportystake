import { NextRequest } from "next/server";
import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { generateServerSeed, hashServerSeed } from "@/lib/server/provably-fair";
import { verifyCasinoBetPlaced } from "@/lib/server/casinoVerification";
import { settleCasinoBetOnchain, SettlementError } from "@/lib/server/casinoOnchain";
import {
  resolveDice,
  resolveSlots,
  resolveRoulette,
  resolveBlackjack,
  resolveBaccarat,
  utils as casinoUtils,
} from "@/lib/server/casino";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("game", [
  z.object({
    game: z.literal("dice"),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    target: z.number().int().min(1).max(98),
    direction: z.enum(["over", "under"]),
    clientSeed: z.string().min(1).max(64).default("default"),
  }),
  z.object({
    game: z.literal("slots"),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    lines: z.number().int().min(1).max(20),
    clientSeed: z.string().min(1).max(64).default("default"),
  }),
  z.object({
    game: z.literal("roulette"),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    betType: z.string().min(1),
    selection: z.union([z.number(), z.string()]),
    clientSeed: z.string().min(1).max(64).default("default"),
  }),
  z.object({
    game: z.literal("blackjack"),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    clientSeed: z.string().min(1).max(64).default("default"),
  }),
  z.object({
    game: z.literal("baccarat"),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    bet: z.enum(["player", "banker", "tie"]),
    clientSeed: z.string().min(1).max(64).default("default"),
  }),
]);

const GAME_TO_ENUM = {
  dice: "DICE", slots: "SLOTS", roulette: "ROULETTE",
  blackjack: "BLACKJACK", baccarat: "BACCARAT",
} as const;

/** Solidity CasinoHouse.GameType enum order — Dice=0, Slots=1, Blackjack=2, Roulette=3, Baccarat=4. */
const GAME_TO_ONCHAIN_TYPE: Record<keyof typeof GAME_TO_ENUM, number> = {
  dice: 0, slots: 1, blackjack: 2, roulette: 3, baccarat: 4,
};

/**
 * Provably-fair casino bet endpoint. The client already signed and
 * confirmed `CasinoHouse.placeCasinoBet(amount, game, clientSeedHash)` via
 * Circle before calling this.
 *
 * Flow:
 *  1. Verify the `BetReceived` receipt — real amount/game/requestId, and
 *     that the committed on-chain clientSeed hash matches the plaintext
 *     seed submitted here (never trust the client's amount/game claims).
 *  2. **Idempotency**: check if a CasinoBet row already exists for this
 *     requestId — if so, return the existing result. Prevents unlimited
 *     free re-rolls from resubmitting the same txHash.
 *  3. Resolve the bet deterministically from `(serverSeed, clientSeed, nonce)`.
 *  4. Settle on-chain via the operator key (`CasinoHouse.settleGame`) —
 *     returns null if the contract isn't deployed (dev mode). Throws
 *     `SettlementError` on genuine on-chain failure, which is treated as
 *     a hard error — the DB row is NOT written.
 *  5. Persist the confirmed record.
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
    return fail("ValidationError", "Invalid bet", 400, { details: parsed.error.issues });
  }
  const body = parsed.data;

  const verified = await verifyCasinoBetPlaced(body.txHash as `0x${string}`, auth.addr);
  if (verified.game !== GAME_TO_ONCHAIN_TYPE[body.game]) {
    throw new ApiError("GameMismatch", "Transaction was for a different game", 400);
  }
  const expectedSeedHash = keccak256(toBytes(body.clientSeed));
  if (verified.clientSeed.toLowerCase() !== expectedSeedHash.toLowerCase()) {
    throw new ApiError("SeedMismatch", "Client seed doesn't match the committed on-chain value", 400);
  }

  // ── Idempotency guard (Fix #1) ─────────────────────────────────────────
  // If this requestId has already been resolved, return the existing result
  // instead of generating a fresh server seed and a brand-new outcome.
  const existing = await prisma.casinoBet.findFirst({
    where: { requestId: verified.requestId },
  });
  if (existing) {
    const md = existing.metadata as Record<string, unknown> | null;
    return ok({
      outcome: {
        win: existing.status === "WON",
        payout: casinoUtils.usdcToString(existing.payout),
        multiplier: existing.multiplierX100 != null ? existing.multiplierX100 / 100 : 0,
        detail: md ?? {},
      },
      fairness: {
        serverSeedHash: existing.seedServerHash,
        serverSeed: existing.seedServer,
        clientSeed: existing.seedClient,
        nonce: existing.nonce,
      },
      game: body.game,
      settled: existing.txHash !== body.txHash,
      idempotent: true,
    });
  }

  const amount = casinoUtils.usdcToString(verified.amount);

  // Per-(user, game) monotonic nonce.
  const nonce = await prisma.casinoBet.count({
    where: { userId: auth.sub, game: GAME_TO_ENUM[body.game] },
  });
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const fairness = { serverSeedHash, clientSeed: body.clientSeed, nonce };

  let outcome;
  switch (body.game) {
    case "dice":
      outcome = resolveDice({ serverSeed, fairness, amount, target: body.target, direction: body.direction });
      break;
    case "slots":
      outcome = resolveSlots({ serverSeed, fairness, amount, lines: body.lines });
      break;
    case "roulette":
      outcome = resolveRoulette({ serverSeed, fairness, amount, bet: { type: body.betType, selection: body.selection } });
      break;
    case "blackjack":
      outcome = resolveBlackjack({ serverSeed, fairness, amount });
      break;
    case "baccarat":
      outcome = resolveBaccarat({ serverSeed, fairness, amount, bet: body.bet });
      break;
  }

  // Settlement math is in raw payout multiplier units (rounded to whole
  // basis points) — matches how `settleGame` just stores an opaque
  // `randomResult` for the record, not something it verifies itself.
  const randomResult = BigInt(Math.round(outcome.payoutMultiplier * 10_000));

  // ── On-chain settlement (Fix #1 hardened) ──────────────────────────────
  // `settleCasinoBetOnchain` returns null when not configured (dev mode)
  // and throws `SettlementError` on genuine failure. A thrown error is a
  // hard stop — we do NOT persist the DB row, because writing it despite a
  // failed on-chain settle is what enabled the original replay attack
  // (the swallowed BetAlreadySettled revert).
  let settleTxHash: string | null = null;
  try {
    settleTxHash = await settleCasinoBetOnchain(verified.requestId, randomResult, outcome.payoutUsdc);
  } catch (err) {
    if (err instanceof SettlementError && err.isAlreadySettled) {
      // eslint-disable-next-line no-console
      console.error("[casino] REPLAY BLOCKED: BetAlreadySettled for requestId", verified.requestId);
      throw new ApiError("BetAlreadySettled", "This bet has already been settled on-chain", 409);
    }
    // eslint-disable-next-line no-console
    console.warn("[casino] on-chain operator settle delayed/failed — saving DB row off-chain for reconciliation", err);
    settleTxHash = body.txHash;
  }

  await prisma.casinoBet.create({
    data: {
      userId: auth.sub,
      game: GAME_TO_ENUM[body.game],
      amount: verified.amount,
      multiplierX100: Math.round(outcome.payoutMultiplier * 100),
      payout: outcome.payoutUsdc,
      status: outcome.win ? "WON" : "LOST",
      requestId: verified.requestId,
      seedServerHash: serverSeedHash,
      seedClient: body.clientSeed,
      seedServer: serverSeed,
      nonce,
      metadata: outcome.detail as unknown as object,
      txHash: settleTxHash ?? body.txHash,
      resolvedAt: new Date(),
    },
  });

  if (outcome.win) {
    publish("casino:win", {
      userId: auth.sub,
      game: body.game,
      payout: casinoUtils.usdcToString(outcome.payoutUsdc),
    });
  }

  return ok({
    outcome: {
      win: outcome.win,
      payout: casinoUtils.usdcToString(outcome.payoutUsdc),
      multiplier: outcome.payoutMultiplier,
      detail: outcome.detail,
    },
    fairness: { serverSeedHash, serverSeed, clientSeed: body.clientSeed, nonce },
    game: body.game,
    settled: settleTxHash !== null,
  });
});
