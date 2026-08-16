import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { publish } from "@/lib/server/event-bus";
import { prisma } from "@/lib/server/db";
import { verifyRoundJoined } from "@/lib/server/crashVerification";
import { utils as casinoUtils } from "@/lib/server/casino";

export const runtime = "nodejs";

const Body = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  clientSeed: z.string().min(1).max(64).default("default"),
});

/**
 * The client already signed and confirmed `CrashGame.joinRound` via Circle
 * before calling this. Verifies the `PlayerJoined` receipt and records a
 * PENDING CasinoBet — `crash-scheduler.worker.ts` reconciles it to
 * WON/LOST once the round resolves, using the contract's own
 * `PayoutCredited` events (covers auto-cashout too).
 *
 * Idempotency (Fix #6): if the same txHash has already been recorded, we
 * return the existing record rather than creating a duplicate PENDING row
 * that would never be reconciled.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);

  const rl = await rateLimit(`crash-join:${auth.sub}`, 30, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Slow down", 429, { details: { retryAfterMs: rl.retryAfterMs } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

  const verified = await verifyRoundJoined(parsed.data.txHash as `0x${string}`, auth.addr);

  // ── Idempotency guard (Fix #6) ─────────────────────────────────────────
  // The on-chain contract prevents double-joins (AlreadyJoined), but a
  // resubmitted txHash would still create a second PENDING row in Postgres
  // that never gets reconciled. Check first, return existing if found.
  const existing = await prisma.casinoBet.findFirst({
    where: { txHash: parsed.data.txHash },
  });
  if (existing) {
    return ok({
      roundId: Number(verified.roundId),
      amount: casinoUtils.usdcToString(verified.amount),
      idempotent: true,
    });
  }

  await prisma.casinoBet.create({
    data: {
      userId: auth.sub,
      game: "CRASH",
      amount: verified.amount,
      status: "PENDING",
      seedClient: parsed.data.clientSeed,
      nonce: Number(verified.roundId),
      metadata: { autoCashoutX100: Number(verified.autoCashoutX100) },
      txHash: parsed.data.txHash,
    },
  });

  publish("crash:state", { kind: "joined", userId: auth.sub, roundId: Number(verified.roundId) });
  return ok({ roundId: Number(verified.roundId), amount: casinoUtils.usdcToString(verified.amount) });
});
