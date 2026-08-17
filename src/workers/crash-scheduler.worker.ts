/**
 * On-chain crash-round scheduler.
 *
 * CrashGame.sol has no on-chain timer — an operator must explicitly call
 * `startRound` -> (wait) -> `lockRound` -> (wait) -> `resolveRound` at the
 * right real-world moments. This worker is that operator, replacing the
 * old in-memory `crash-engine.ts` mock loop.
 *
 * Timing: the crash point only depends on (serverSeed, roundId), both
 * known the instant the round starts, so the worker precomputes it
 * immediately to time the "flight" duration — using the EXACT same
 * formula as `CrashGame._crashFromSeed` (keccak256, not the unrelated
 * HMAC-based formula in provably-fair.ts, which is for the off-chain
 * casino games). The precomputed value is kept in a local variable and
 * never written to Redis until the round actually resolves — otherwise a
 * player polling `/api/casino/crash/state` mid-flight could read the
 * answer early and cash out perfectly every time.
 *
 * Publishes round state to Redis (`crash:state`) so `/api/casino/crash/state`
 * is a cheap read, not a per-request chain call.
 *
 * Operator key: uses the centralized `operatorWallet` factory (Fix #3) —
 * reads `OPERATOR_PRIVATE_KEY_CRASH` first, falls back to `OPERATOR_PRIVATE_KEY`.
 * Run it: `npx tsx src/workers/crash-scheduler.worker.ts`, or
 * `npm run worker:crash`.
 */
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  decodeEventLog,
  type Hash,
} from "viem";
import { redis } from "@/lib/server/redis";
import { prisma } from "@/lib/server/db";
import { serverEnv, clientEnv } from "@/lib/env";
import { requireOperatorWallet, getOperatorAccount, verifyOperatorRoles } from "@/lib/server/operatorWallet";
import { logger } from "@/lib/server/logger";
import { crashGameAbi } from "../../packages/sdk/src/contracts/abis/CrashGame";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REDIS_STATE_KEY = "crash:state";
const REDIS_HISTORY_KEY = "crash:history";
const HISTORY_KEEP = 50;

const WAIT_MS = 15 * 60 * 1000; // 15-minute betting window
const CRASH_GRACE_MS = 4_000;  // pause after crash before the next round
const MAX_FLIGHT_MS = 25_000;  // hard cap so a huge multiplier can't stall the loop
const GROWTH_RATE = 0.07;      // matches the client's animation curve (100 * e^(rate*t))
const MAX_AUTOCASHOUT_X100 = 100_000;
const ROUND_TIMEOUT_SECONDS = 30 * 60; // 30 minutes — matches CrashGame.ROUND_TIMEOUT

interface PublicRoundState {
  id: number;
  status: "waiting" | "running" | "crashed";
  serverSeedHash: `0x${string}`;
  waitingSince: number;
  startedAt?: number;
  crashMultiplierX100?: number;
  serverSeed?: `0x${string}`;
}

/** Mirrors CrashGame._crashFromSeed exactly — keccak256-based, NOT the HMAC formula in provably-fair.ts. */
function onchainCrashMultiplierX100(seed: `0x${string}`, roundId: bigint): number {
  const mix = keccak256(encodePacked(["bytes32", "uint256"], [seed, roundId]));
  const r = BigInt(mix);
  if (r % 100n === 0n) return 100;
  const e = r % 1_000_000n;
  let crashX100 = (99n * 1_000_000n) / (1_000_000n - e);
  if (crashX100 < 101n) crashX100 = 101n;
  if (crashX100 > BigInt(MAX_AUTOCASHOUT_X100)) crashX100 = BigInt(MAX_AUTOCASHOUT_X100);
  return Number(crashX100);
}

function flightDurationMs(crashX100: number): number {
  const ratio = crashX100 / 100;
  const seconds = Math.log(ratio) / GROWTH_RATE;
  return Math.min(MAX_FLIGHT_MS, Math.max(500, Math.round(seconds * 1000)));
}

async function writeState(state: PublicRoundState): Promise<void> {
  await redis().set(REDIS_STATE_KEY, JSON.stringify(state));
}

async function pushHistory(crashX100: number): Promise<void> {
  const r = redis();
  await r.lpush(REDIS_HISTORY_KEY, String(crashX100));
  await r.ltrim(REDIS_HISTORY_KEY, 0, HISTORY_KEEP - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap(): Promise<void> {
  const crashGameAddress = clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS as `0x${string}`;
  if (crashGameAddress === ZERO_ADDRESS) {
    logger.warn("[crash] CrashGame not deployed — scheduler idle");
    return;
  }

  // Fix #3: use per-contract operator wallet
  const account = getOperatorAccount("crashGame");
  if (!account) {
    if (serverEnv.NODE_ENV === "production") {
      throw new Error("Operator key for crashGame required for crash scheduler");
    }
    logger.warn("[crash] No operator key configured — scheduler idle in dev");
    return;
  }

  const wallet = requireOperatorWallet("crashGame");
  await verifyOperatorRoles([{ name: "crashGame", address: crashGameAddress }]);

  const chain = {
    id: clientEnv.NEXT_PUBLIC_CHAIN_ID, name: "arc",
    nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
    rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
  } as const;
  const publicClient = createPublicClient({ chain, transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });

  logger.info("[crash] scheduler online", { operator: account.address });

  // ── Fix #5: recover stuck rounds on startup ──────────────────────────
  await recoverStuckRounds(publicClient, wallet, crashGameAddress);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runRound(publicClient, wallet, crashGameAddress);
    } catch (err) {
      logger.error("[crash] round error — retrying after a pause", { error: String(err) });
      await sleep(5_000);
    }
  }
}

/**
 * Fix #5: on startup, check if the current round is stuck — either Pending
 * (startRound ran but the process died before lockRound: this exact
 * scenario happened for real on 2026-08-08, round 44 sat Pending for three
 * days and blocked every subsequent round, since startRound refuses to run
 * while one is still Pending/Running) or Running past the timeout — and
 * cancel it via the appropriate on-chain escape hatch.
 */
async function recoverStuckRounds(
  publicClient: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof requireOperatorWallet>,
  crashGameAddress: `0x${string}`,
): Promise<void> {
  try {
    const currentId = await publicClient.readContract({
      address: crashGameAddress,
      abi: crashGameAbi,
      functionName: "currentRoundId",
    });
    if (currentId === 0n) return;

    const round = await publicClient.readContract({
      address: crashGameAddress,
      abi: crashGameAbi,
      functionName: "rounds",
      args: [currentId],
    }) as unknown as readonly unknown[];

    // Round struct: [id, serverSeedHash, serverSeed, startedAt, resolvedAt, crashMultiplierX100, totalStaked, maxPotentialPayout, status]
    const status = Number(round[8]);
    const startedAt = Number(round[3]);

    if (status === 0) {
      // Pending — startRound ran, lockRound never did. No timeout wait
      // needed: nobody has an active in-flight multiplier yet, every joined
      // player is owed an exact 1:1 refund regardless of when this runs.
      logger.critical("[crash] Found round stuck Pending (crashed before lockRound) — cancelling", {
        roundId: Number(currentId),
      });
      await cancelAndReconcile(publicClient, wallet, crashGameAddress, currentId, "cancelPendingRound");
    } else if (status === 1 && startedAt > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (now > startedAt + ROUND_TIMEOUT_SECONDS) {
        logger.critical("[crash] Found stuck round — cancelling via escape hatch", {
          roundId: Number(currentId),
          startedAt,
          stuckForSeconds: now - startedAt,
        });
        await cancelAndReconcile(publicClient, wallet, crashGameAddress, currentId, "cancelStuckRound");
      }
    }
  } catch (err) {
    logger.error("[crash] Failed to recover stuck rounds", { error: String(err) });
  }
}

async function cancelAndReconcile(
  publicClient: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof requireOperatorWallet>,
  crashGameAddress: `0x${string}`,
  roundId: bigint,
  functionName: "cancelPendingRound" | "cancelStuckRound",
): Promise<void> {
  const cancelTxHash: Hash = await wallet.writeContract({
    account: wallet.account!, chain: wallet.chain,
    address: crashGameAddress, abi: crashGameAbi, functionName, args: [roundId],
  });
  await publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
  await reconcileCancelledBets(roundId);
  logger.info("[crash] Stuck round cancelled and refunded", { roundId: Number(roundId), via: functionName });
}

/** Mark all PENDING bets for a cancelled round as REFUNDED. */
async function reconcileCancelledBets(roundId: bigint): Promise<void> {
  await prisma.casinoBet.updateMany({
    where: { game: "CRASH", nonce: Number(roundId), status: "PENDING" },
    data: {
      status: "REFUNDED",
      resolvedAt: new Date(),
      metadata: { cancelled: true, reason: "round_timeout" },
    },
  });
}

async function runRound(
  publicClient: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof requireOperatorWallet>,
  crashGameAddress: `0x${string}`,
): Promise<void> {
  const serverSeed = ("0x" + Buffer.from(randomBytes(32)).toString("hex")) as `0x${string}`;
  const serverSeedHash = keccak256(serverSeed);

  const startTxHash = await wallet.writeContract({
    account: wallet.account!, chain: wallet.chain,
    address: crashGameAddress, abi: crashGameAbi, functionName: "startRound", args: [serverSeedHash],
  });
  const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startTxHash });
  const roundId = decodeRoundId(startReceipt.logs);

  const waitingSince = Date.now();
  await writeState({ id: Number(roundId), status: "waiting", serverSeedHash, waitingSince });

  await sleep(WAIT_MS);

  const lockTxHash: Hash = await wallet.writeContract({
    account: wallet.account!, chain: wallet.chain,
    address: crashGameAddress, abi: crashGameAbi, functionName: "lockRound", args: [roundId],
  });
  await publicClient.waitForTransactionReceipt({ hash: lockTxHash });

  const startedAt = Date.now();
  await writeState({ id: Number(roundId), status: "running", serverSeedHash, waitingSince, startedAt });

  // Precomputed locally — never written to Redis until resolve.
  const crashMultiplierX100 = onchainCrashMultiplierX100(serverSeed, roundId);
  await sleep(flightDurationMs(crashMultiplierX100));

  const resolveTxHash = await wallet.writeContract({
    account: wallet.account!, chain: wallet.chain,
    address: crashGameAddress, abi: crashGameAbi, functionName: "resolveRound", args: [roundId, serverSeed],
  });
  const resolveReceipt = await publicClient.waitForTransactionReceipt({ hash: resolveTxHash });

  await writeState({
    id: Number(roundId), status: "crashed", serverSeedHash, waitingSince, startedAt,
    crashMultiplierX100, serverSeed,
  });
  await pushHistory(crashMultiplierX100);
  await reconcilePendingBets(roundId, crashMultiplierX100, decodePayouts(resolveReceipt.logs)).catch((err) => {
    logger.error("[crash] reconcile failed", { error: String(err), roundId: Number(roundId) });
  });

  logger.info("[crash] round resolved", {
    roundId: Number(roundId),
    crashAt: (crashMultiplierX100 / 100).toFixed(2),
  });

  await sleep(CRASH_GRACE_MS);
}

function decodeRoundId(logs: import("viem").TransactionReceipt["logs"]): bigint {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: crashGameAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "RoundStarted") return decoded.args.roundId;
    } catch { /* not this event */ }
  }
  throw new Error("RoundStarted event not found");
}

/** Decodes every `PayoutCredited` event from a resolveRound receipt — the contract's authoritative per-player payout (covers both manual and auto-cashout wins). */
function decodePayouts(logs: import("viem").TransactionReceipt["logs"]): Map<string, bigint> {
  const payouts = new Map<string, bigint>();
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: crashGameAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "PayoutCredited") {
        payouts.set((decoded.args.player as string).toLowerCase(), decoded.args.amount as bigint);
      }
    } catch { /* not this event */ }
  }
  return payouts;
}

/**
 * Mark every CasinoBet row recorded for this round (via the join/cashout
 * routes) as WON/LOST using the contract's own `PayoutCredited` events as
 * ground truth — covers auto-cashout wins the join/cashout routes never
 * see directly, unlike guessing from a client-reported multiplier.
 */
async function reconcilePendingBets(roundId: bigint, crashMultiplierX100: number, payouts: Map<string, bigint>): Promise<void> {
  const bets = await prisma.casinoBet.findMany({
    where: { game: "CRASH", nonce: Number(roundId), status: "PENDING" },
    include: { user: { select: { walletAddress: true } } },
  });
  for (const bet of bets) {
    const payout = payouts.get(bet.user.walletAddress.toLowerCase()) ?? 0n;
    const won = payout > 0n;
    const md = (bet.metadata as Record<string, unknown> | null) ?? null;
    await prisma.casinoBet.update({
      where: { id: bet.id },
      data: {
        status: won ? "WON" : "LOST",
        payout,
        metadata: { ...md, crashMultiplierX100 },
        resolvedAt: new Date(),
      },
    });
  }
}

bootstrap().catch((err) => {
  logger.critical("[crash] fatal", { error: String(err) });
  process.exit(1);
});
