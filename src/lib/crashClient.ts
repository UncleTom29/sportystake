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
