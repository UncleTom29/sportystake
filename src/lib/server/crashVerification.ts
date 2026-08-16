/**
 * Server-side verification for CrashGame writes — same trust posture as
 * the other `*Verification.ts` helpers.
 */
import { decodeEventLog, type TransactionReceipt } from "viem";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { ApiError } from "@/lib/server/api-response";
import { crashGameAbi } from "../../../packages/sdk/src/contracts/abis/CrashGame";

function crashGameAddress() {
  return clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS as `0x${string}`;
}

async function getConfirmedReceipt(txHash: `0x${string}`) {
  const receipt = await publicClient().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new ApiError("TransactionFailed", "The on-chain transaction did not succeed", 409);
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
