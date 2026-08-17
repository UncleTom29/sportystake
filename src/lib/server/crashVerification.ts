/**
 * Server-side verification for CrashGame writes — same trust posture as
 * the other `*Verification.ts` helpers.
 */
import { decodeErrorResult, decodeEventLog, type TransactionReceipt } from "viem";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { ApiError } from "@/lib/server/api-response";
import { crashGameAbi } from "../../../packages/sdk/src/contracts/abis/CrashGame";

function crashGameAddress() {
  return clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS as `0x${string}`;
}

/** Hand-written copy for reverts a player can actually cause/act on — same
 *  pattern as betVerification.ts's FRIENDLY_REVERT_MESSAGES. */
const FRIENDLY_REVERT_MESSAGES: Record<string, string> = {
  AlreadyJoined: "You've already placed a bet in this round.",
  RoundNotPending: "This round has already started — wait for the next one.",
  RoundNotRunning: "This round already ended.",
  RoundAlreadyResolved: "This round has already been settled.",
  NotJoined: "No bet found for this round.",
  AlreadyCashedOut: "You've already cashed out this round.",
  StakeOutOfRange: "Bet amount is outside the allowed range.",
  TooManyPlayers: "This round is full — try the next one.",
  InsufficientBankroll: "The casino bankroll can't cover this payout right now.",
  NoPendingPayout: "Nothing to claim right now.",
};

/** camelCase/PascalCase error name -> "Camel Case Error Name". */
function humanizeErrorName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/**
 * Replays the exact failed call via eth_call at the same block to recover
 * the revert reason, then decodes it against CrashGame's error ABI.
 * Best-effort — returns null (falls back to a generic message) if the tx
 * can't be found, the replay doesn't reproduce the revert, or the selector
 * isn't one we have listed. Mirrors betVerification.ts's decodeRevertReason.
 */
async function decodeRevertReason(txHash: `0x${string}`): Promise<string | null> {
  try {
    const client = publicClient();
    const tx = await client.getTransaction({ hash: txHash });
    if (!tx.to || tx.blockNumber === null) return null;
    await client.request({
      method: "eth_call",
      params: [
        { from: tx.from, to: tx.to, data: tx.input, value: `0x${tx.value.toString(16)}` },
        `0x${tx.blockNumber.toString(16)}`,
      ],
    });
    return null; // Replay didn't revert — nothing to decode.
  } catch (err) {
    const data = (err as { data?: string; cause?: { data?: string } })?.data
      ?? (err as { cause?: { data?: string } })?.cause?.data;
    if (!data || data === "0x") return null;
    try {
      const decoded = decodeErrorResult({ abi: crashGameAbi, data: data as `0x${string}` });
      return FRIENDLY_REVERT_MESSAGES[decoded.errorName] ?? humanizeErrorName(decoded.errorName) + ".";
    } catch {
      return null; // Selector not in our (partial, verified) error list.
    }
  }
}

async function getConfirmedReceipt(txHash: `0x${string}`) {
  const receipt = await publicClient().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    const reason = await decodeRevertReason(txHash).catch(() => null);
    throw new ApiError("TransactionFailed", reason ?? "The on-chain transaction did not succeed", 409);
  }
  if (receipt.to?.toLowerCase() !== crashGameAddress().toLowerCase()) {
    throw new ApiError("WrongContract", "Transaction was not sent to CrashGame", 400);
  }
  return receipt;
}

function decodeCrashLog(logs: TransactionReceipt["logs"], eventName: string) {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: crashGameAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === eventName) return decoded.args as Record<string, unknown>;
    } catch {
      // Not a CrashGame log (or not this event) — skip.
    }
  }
  return null;
}

function requirePlayer(args: Record<string, unknown> | null, expectedPlayer: string) {
  if (!args) return null;
  const player = args.player as string;
  if (player.toLowerCase() !== expectedPlayer.toLowerCase()) {
    throw new ApiError("PlayerMismatch", "Transaction was not sent by the signed-in wallet", 403);
  }
  return args;
}

export async function verifyRoundJoined(txHash: `0x${string}`, expectedPlayer: string): Promise<{ roundId: bigint; amount: bigint; autoCashoutX100: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requirePlayer(decodeCrashLog(receipt.logs, "PlayerJoined"), expectedPlayer);
  if (!args) throw new ApiError("EventNotFound", "No PlayerJoined event in this transaction", 400);
  return { roundId: args.roundId as bigint, amount: args.amount as bigint, autoCashoutX100: args.autoCashoutX100 as bigint };
}

export async function verifyCashedOut(txHash: `0x${string}`, expectedPlayer: string): Promise<{ roundId: bigint; multiplierX100: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requirePlayer(decodeCrashLog(receipt.logs, "PlayerCashedOut"), expectedPlayer);
  if (!args) throw new ApiError("EventNotFound", "No PlayerCashedOut event in this transaction", 400);
  return { roundId: args.roundId as bigint, multiplierX100: args.multiplierX100 as bigint };
}

export async function verifyPayoutClaimed(txHash: `0x${string}`, expectedPlayer: string): Promise<{ amount: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requirePlayer(decodeCrashLog(receipt.logs, "PayoutClaimed"), expectedPlayer);
  if (!args) throw new ApiError("EventNotFound", "No PayoutClaimed event in this transaction", 400);
  return { amount: args.amount as bigint };
}
