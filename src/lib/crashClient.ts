"use client";

// Signs CrashGame writes (joinRound/cashOut/claim) via the user's Privy
// wallet. Round lifecycle (startRound/lockRound/resolveRound) is entirely
// operator-driven by crash-scheduler.worker.ts — this file only covers the
// three player-facing entry points.

import type { Address, Hash } from "viem";
import { useWallet } from "@/lib/walletStore";
import { clientEnv } from "@/lib/env";
import { privyApproveIfNeeded, privyContractWrite } from "@/lib/privyTx";
import { getPublicClient } from "@/lib/publicClient";
import { parseUsdc } from "../../packages/sdk/src/utils";
import { crashGameAbi } from "../../packages/sdk/src/contracts/abis/CrashGame";

function requireAddress(): Address {
  const address = useWallet.getState().address;
  if (!address) throw new Error("Sign in first");
  return address;
}

function crashGameAddress(): Address {
  return clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS as Address;
}

export async function joinCrashRound(input: {
  roundId: number;
  amountUsdc: string | number;
  autoCashoutX100?: number;
}): Promise<{ txHash: Hash }> {
  const address = requireAddress();
  const usdc = clientEnv.NEXT_PUBLIC_USDC_ADDRESS as Address;
  const amount = parseUsdc(input.amountUsdc);

  await privyApproveIfNeeded({ token: usdc, owner: address, spender: crashGameAddress(), amount });
  const receipt = await privyContractWrite({
    contractAddress: crashGameAddress(),
    abiFunctionSignature: "joinRound(uint256,uint256,uint256)",
    abiParameters: [BigInt(input.roundId), amount, BigInt(input.autoCashoutX100 ?? 0)],
  });
  return { txHash: receipt.transactionHash };
}

export async function cashOutCrashRound(input: { roundId: number; multiplierX100: number }): Promise<{ txHash: Hash }> {
  const receipt = await privyContractWrite({
    contractAddress: crashGameAddress(),
    abiFunctionSignature: "cashOut(uint256,uint256)",
    abiParameters: [BigInt(input.roundId), BigInt(input.multiplierX100)],
  });
  return { txHash: receipt.transactionHash };
}

export async function claimCrashPayout(): Promise<{ txHash: Hash }> {
  const receipt = await privyContractWrite({
    contractAddress: crashGameAddress(),
    abiFunctionSignature: "claim()",
    abiParameters: [],
  });
  return { txHash: receipt.transactionHash };
}

export async function getPendingCrashPayout(address: Address): Promise<bigint> {
  return getPublicClient().readContract({
    address: crashGameAddress(),
    abi: crashGameAbi,
    functionName: "pendingPayout",
    args: [address],
  });
}

export interface OnchainCrashEntry {
  amount: bigint;
  autoCashoutX100: number;
  cashedOutAtX100: number | null;
  resolved: boolean;
}

/**
 * Reads `address`'s entry (if any) directly from CrashGame for `roundId` —
 * the contract is the only source of truth for "have I already joined this
 * round," since a page refresh (or a joinRound tx that confirmed on-chain
 * but whose follow-up server recording call failed) both leave no trace in
 * local React state. Batched into one round-trip via the public client's
 * multicall setting; `getRoundPlayerCount` is typically small (capped at
 * MAX_PLAYERS_PER_ROUND = 100 on-chain), so this stays cheap even in the
 * worst case.
 */
export async function getMyCrashEntry(roundId: number, address: Address): Promise<OnchainCrashEntry | null> {
  const client = getPublicClient();
  const count = await client.readContract({
    address: crashGameAddress(),
    abi: crashGameAbi,
    functionName: "getRoundPlayerCount",
    args: [BigInt(roundId)],
  });
  if (count === 0n) return null;

  const entries = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) =>
      client.readContract({
        address: crashGameAddress(),
        abi: crashGameAbi,
        functionName: "roundPlayers",
        args: [BigInt(roundId), BigInt(i)],
      }),
    ),
  );

  const mine = entries.find((e) => (e[0] as string).toLowerCase() === address.toLowerCase());
  if (!mine) return null;
  const [, amount, autoCashoutX100, cashedOutAtX100, resolved] = mine as unknown as [
    Address, bigint, bigint, bigint, boolean,
  ];
  return {
    amount,
    autoCashoutX100: Number(autoCashoutX100),
    cashedOutAtX100: cashedOutAtX100 > 0n ? Number(cashedOutAtX100) : null,
    resolved,
  };
}
