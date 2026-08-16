/**
 * Server-side verification for LiquidityPool writes — same trust posture
 * as `betVerification.ts`: the client signs and broadcasts via Circle,
 * this re-fetches the receipt and decodes the real event rather than
 * trusting client-supplied amounts.
 */
import { decodeEventLog, type TransactionReceipt } from "viem";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { ApiError } from "@/lib/server/api-response";
import { liquidityPoolAbi } from "../../../packages/sdk/src/contracts/abis/LiquidityPool";

function poolAddress() {
  return clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS as `0x${string}`;
}

async function getConfirmedReceipt(txHash: `0x${string}`) {
  const receipt = await publicClient().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new ApiError("TransactionFailed", "The on-chain transaction did not succeed", 409);
  }
  if (receipt.to?.toLowerCase() !== poolAddress().toLowerCase()) {
    throw new ApiError("WrongContract", "Transaction was not sent to LiquidityPool", 400);
  }
  return receipt;
}

function decodePoolLog(logs: TransactionReceipt["logs"], eventName: string) {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: liquidityPoolAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === eventName) return decoded.args as Record<string, unknown>;
    } catch {
      // Not a LiquidityPool log (or not this event) — skip.
    }
  }
  return null;
}

function requireLp(args: Record<string, unknown> | null, expectedLp: string) {
  if (!args) return null;
  const lp = args.lp as string;
  if (lp.toLowerCase() !== expectedLp.toLowerCase()) {
    throw new ApiError("LpMismatch", "Transaction was not sent by the signed-in wallet", 403);
  }
  return args;
}

export async function verifyDeposit(txHash: `0x${string}`, expectedLp: string): Promise<{ usdcAmount: bigint; sharesMinted: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requireLp(decodePoolLog(receipt.logs, "Deposited"), expectedLp);
  if (!args) throw new ApiError("EventNotFound", "No Deposited event in this transaction", 400);
  return { usdcAmount: args.usdcAmount as bigint, sharesMinted: args.sharesMinted as bigint };
}

export async function verifyWithdrawalRequested(txHash: `0x${string}`, expectedLp: string): Promise<{ unlockAt: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requireLp(decodePoolLog(receipt.logs, "WithdrawalRequested"), expectedLp);
  if (!args) throw new ApiError("EventNotFound", "No WithdrawalRequested event in this transaction", 400);
  return { unlockAt: args.unlockAt as bigint };
}

export async function verifyWithdrawalExecuted(txHash: `0x${string}`, expectedLp: string): Promise<{ sharesBurned: bigint; usdcOut: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = requireLp(decodePoolLog(receipt.logs, "WithdrawalExecuted"), expectedLp);
  if (!args) throw new ApiError("EventNotFound", "No WithdrawalExecuted event in this transaction", 400);
  return { sharesBurned: args.sharesBurned as bigint, usdcOut: args.usdcOut as bigint };
}
