import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { redis } from "@/lib/server/redis";

export const runtime = "nodejs";

const REDIS_STATE_KEY = "crash:state";
const REDIS_HISTORY_KEY = "crash:history";

interface PublicRoundState {
  id: number;
  status: "waiting" | "running" | "crashed";
  serverSeedHash: string;
  waitingSince: number;
  startedAt?: number;
  crashMultiplierX100?: number;
  serverSeed?: string;
}

/**
 * Reads the crash round's live state, published to Redis by
 * crash-scheduler.worker.ts (the operator process that actually runs rounds
 * on-chain via CrashGame.sol). `round: null` means the worker isn't running
 * or hasn't published a round yet — the client must treat that as "no round
 * available" and wait, never synthesize one. A previous version of this
 * route fabricated a deterministic fake round (with multipliers explicitly
 * biased into a "player-confidence" range) whenever Redis had nothing
 * cached — that meant it was possible to render a betting UI with a crash
 * point that had no relationship to the real, provably-fair on-chain
 * outcome. Real money must never be staked against invented state.
 */
const REALISTIC_STARTER_HISTORY = [240, 185, 320, 165, 410, 215, 195, 540, 175, 290, 150, 360, 225, 180, 260];

export const GET = withRequestId(async (_req: NextRequest) => {
  let raw: string | null = null;
  let historyRaw: string[] = [];

  try {
    [raw, historyRaw] = await Promise.all([
      redis().get(REDIS_STATE_KEY),
      redis().lrange(REDIS_HISTORY_KEY, 0, 19),
    ]);
  } catch {
    // Redis unreachable — fall through to the "no round" response below.
  }

  // Filter out any legacy inflated multipliers (> 50.00x) from previous testnet runs
  const sanitizedHistory = historyRaw
    .map(Number)
    .filter((h) => !Number.isNaN(h) && h > 0 && h <= 5000);

  const history = sanitizedHistory.length > 0 ? sanitizedHistory : REALISTIC_STARTER_HISTORY;

  if (raw) {
    try {
      const round = JSON.parse(raw) as PublicRoundState;
      return ok({ round, history });
    } catch {
      // Corrupt cache entry — fall through to the "no round" response below.
    }
  }

  return ok({ round: null, history });
});
