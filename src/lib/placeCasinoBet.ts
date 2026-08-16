"use client";

// Signs CasinoHouse.placeCasinoBet via the user's Privy wallet, then hands
// the resulting txHash to the caller to submit to /api/casino/bet for
// verification + resolution + on-chain settlement.

import { keccak256, toBytes, type Address, type Hash } from "viem";
import { useWallet } from "@/lib/walletStore";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { clientEnv } from "@/lib/env";
import { privyApproveIfNeeded, privyContractWrite } from "@/lib/privyTx";
import { Casino } from "@/lib/api-client";
import { parseUsdc } from "../../packages/sdk/src/utils";

export type CasinoGameKey = "dice" | "slots" | "roulette" | "blackjack" | "baccarat";

/** Solidity CasinoHouse.GameType enum order — Dice=0, Slots=1, Blackjack=2, Roulette=3, Baccarat=4. */
const GAME_TO_ONCHAIN_TYPE: Record<CasinoGameKey, number> = {
  dice: 0, slots: 1, blackjack: 2, roulette: 3, baccarat: 4,
};

export interface PendingCasinoBet {
  txHash: string;
  game: CasinoGameKey;
  amount: number;
  clientSeed: string;
  params: Record<string, unknown>;
  timestamp: number;
}

const PENDING_STORAGE_PREFIX = "sportystake:pending_casino_bet";

export function savePendingCasinoBet(bet: PendingCasinoBet): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PENDING_STORAGE_PREFIX}:${bet.game}`, JSON.stringify(bet));
    localStorage.setItem(PENDING_STORAGE_PREFIX, JSON.stringify(bet));
  } catch {}
}

export function getPendingCasinoBet(game?: CasinoGameKey): PendingCasinoBet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = game
      ? localStorage.getItem(`${PENDING_STORAGE_PREFIX}:${game}`)
      : localStorage.getItem(PENDING_STORAGE_PREFIX);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCasinoBet;
  } catch {
    return null;
  }
}

export function clearPendingCasinoBet(game?: CasinoGameKey): void {
  if (typeof window === "undefined") return;
  try {
    if (game) {
      localStorage.removeItem(`${PENDING_STORAGE_PREFIX}:${game}`);
    }
    localStorage.removeItem(PENDING_STORAGE_PREFIX);
  } catch {}
}

export async function placeCasinoBetOnchain(input: {
  amountUsdc: string | number;
  game: CasinoGameKey;
  clientSeed: string;
}): Promise<{ txHash: Hash }> {
  const address = useWallet.getState().address;
  if (!address) throw new Error("Sign in first");

  const casinoHouse = (CONTRACT_ADDRESSES.casinoHouse || clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS) as Address;
  const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as Address;
  const amount = parseUsdc(input.amountUsdc);
  const clientSeedHash = keccak256(toBytes(input.clientSeed));

  await privyApproveIfNeeded({ token: usdc, owner: address, spender: casinoHouse, amount });
  const receipt = await privyContractWrite({
    contractAddress: casinoHouse,
    abiFunctionSignature: "placeCasinoBet(uint256,uint8,bytes32)",
    abiParameters: [amount, GAME_TO_ONCHAIN_TYPE[input.game], clientSeedHash],
  });

  return { txHash: receipt.transactionHash };
}

/**
 * Resolves a placed casino bet on the backend with automatic exponential backoff retry.
 * If all retries fail, persists the pending bet metadata in localStorage so it can be resumed.
 */
export async function resolveCasinoBetWithRetry(
  body: { game: CasinoGameKey; txHash: string; clientSeed: string; [key: string]: unknown },
  maxRetries = 3,
): Promise<{
  outcome: { win: boolean; payout: string; multiplier: number; detail: Record<string, unknown> };
  fairness: { serverSeedHash: string; serverSeed: string; clientSeed: string; nonce: number };
  game: string;
  settled: boolean;
}> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await Casino.bet(body);
      clearPendingCasinoBet(body.game);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }

  // Save pending bet so user or page can retry recovery
  savePendingCasinoBet({
    txHash: body.txHash,
    game: body.game,
    amount: Number(body.amount ?? 0),
    clientSeed: body.clientSeed,
    params: body,
    timestamp: Date.now(),
  });

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
