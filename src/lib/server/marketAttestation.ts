/**
 * Signs MarketAttestation tickets so a bettor's own wallet can
 * permissionlessly register a market on BettingCore as part of placing a
 * bet — see BettingCore.sol's ORACLE_SIGNER_ROLE / placeBetWithAttestation.
 *
 * This is pure off-chain ECDSA signing (EIP-712) — no gas, no on-chain call.
 * The signing key must be granted ORACLE_SIGNER_ROLE via
 * scripts/initialize-v2.ts (or grantRole from an admin) before signatures
 * from it are accepted on-chain.
 */
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { clientEnv, serverEnv } from "@/lib/env";
import { getPublicClient } from "@/lib/publicClient";
import type { MarketAttestationDTO } from "@/lib/types";

const ATTESTATION_VALIDITY_SECONDS = 10 * 60; // matches the window described to the oracle key operator

const marketsAbi = [
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "id", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "winningOutcome", type: "uint8" },
      { name: "totalBetAmount", type: "uint256" },
      { name: "totalPayoutRequired", type: "uint256" },
      { name: "closesAt", type: "uint64" },
      { name: "fillRatioX1000", type: "uint256" },
    ],
  },
] as const;

let cachedAccount: PrivateKeyAccount | null | undefined;

function getOracleAccount(): PrivateKeyAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const key = serverEnv.ORACLE_ATTESTATION_PRIVATE_KEY;
  if (!key) {
    cachedAccount = null;
    return null;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("ORACLE_ATTESTATION_PRIVATE_KEY must be a 0x-prefixed 64-char hex string");
  }
  cachedAccount = privateKeyToAccount(key as `0x${string}`);
  return cachedAccount;
}

export function isMarketAttestationConfigured(): boolean {
  return getOracleAccount() !== null;
}

export async function isMarketRegisteredOnChain(marketId: `0x${string}`): Promise<boolean> {
  const m = await getPublicClient().readContract({
    address: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`,
    abi: marketsAbi,
    functionName: "markets",
    args: [marketId],
  });
  return m[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
}

/** Signs a fresh attestation for `marketId`/`closesAt`. Caller must have already confirmed the market isn't registered on-chain. */
export async function signMarketAttestation(input: {
  marketId: `0x${string}`;
  closesAt: number; // unix seconds
}): Promise<MarketAttestationDTO> {
  const account = getOracleAccount();
  if (!account) {
    throw new Error("ORACLE_ATTESTATION_PRIVATE_KEY is not configured");
  }

  const validUntil = Math.floor(Date.now() / 1000) + ATTESTATION_VALIDITY_SECONDS;

  const signature = await account.signTypedData({
    domain: {
      name: "BettingCore",
      version: "1",
      chainId: clientEnv.NEXT_PUBLIC_CHAIN_ID,
      verifyingContract: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`,
    },
    types: {
      MarketAttestation: [
        { name: "marketId", type: "bytes32" },
        { name: "closesAt", type: "uint64" },
        { name: "validUntil", type: "uint64" },
      ],
    },
    primaryType: "MarketAttestation",
    message: {
      marketId: input.marketId,
      closesAt: BigInt(input.closesAt),
      validUntil: BigInt(validUntil),
    },
  });

  return { marketId: input.marketId, closesAt: input.closesAt, validUntil, signature };
}

/**
 * Convenience wrapper for API routes: returns an attestation only if
 * signing is configured AND the market isn't already on-chain. Returns
 * undefined (never throws) otherwise, so callers can attach it unconditionally.
 */
export async function maybeAttestMarket(input: {
  marketId: string;
  closesAt: Date;
}): Promise<MarketAttestationDTO | undefined> {
  if (!isMarketAttestationConfigured()) return undefined;
  const marketId = input.marketId as `0x${string}`;
  try {
    if (await isMarketRegisteredOnChain(marketId)) return undefined;
    return await signMarketAttestation({ marketId, closesAt: Math.floor(input.closesAt.getTime() / 1000) });
  } catch (err) {
    console.warn("[marketAttestation] failed to attest market, omitting:", err);
    return undefined;
  }
}
