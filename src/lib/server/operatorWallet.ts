/**
 * Centralized operator wallet factory — each contract gets its own key so a
 * leak from one game doesn't compromise the whole bankroll.
 *
 * Env precedence:
 *   1. Per-contract key: OPERATOR_PRIVATE_KEY_CASINO, _CRASH, _BETTING
 *   2. Shared fallback: OPERATOR_PRIVATE_KEY (for backwards compatibility)
 *
 * Returns null when no key is configured (dev-mode graceful degradation).
 * Designed so a KMS/HSM adapter can replace `privateKeyToAccount` later —
 * callers only see WalletClient, never the raw key.
 */

import { createPublicClient, createWalletClient, http, keccak256, toBytes, type WalletClient } from "viem";
import { privateKeyToAccount, type Account } from "viem/accounts";
import { clientEnv } from "@/lib/env";

export type ContractName = "casinoHouse" | "crashGame" | "bettingCore";

const chain = {
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: "arc",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
} as const;

const walletCache = new Map<ContractName, WalletClient>();
const accountCache = new Map<ContractName, Account>();
const warnedCache = new Set<ContractName>();

function getEnvKeyInfo(contract: ContractName): { key: string; source: string } | null {
  const envVarMap: Record<ContractName, string> = {
    casinoHouse: "OPERATOR_PRIVATE_KEY_CASINO",
    crashGame: "OPERATOR_PRIVATE_KEY_CRASH",
    bettingCore: "OPERATOR_PRIVATE_KEY_BETTING",
  };

  const specificSource = envVarMap[contract];
  const specificKey = process.env[specificSource];

  if (specificKey) {
    return { key: specificKey, source: specificSource };
  }

  const fallbackSource = "OPERATOR_PRIVATE_KEY";
  const fallbackKey = process.env[fallbackSource];

  if (fallbackKey) {
    return { key: fallbackKey, source: fallbackSource };
  }

  return null;
}

function validateKey(key: string): asserts key is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("Operator key must be a 0x-prefixed 64-char hex string");
  }
}

export function getOperatorAccount(contract: ContractName): Account | null {
  if (accountCache.has(contract)) {
    return accountCache.get(contract)!;
  }

  const info = getEnvKeyInfo(contract);
  if (!info) {
    return null;
  }

  validateKey(info.key);
  const account = privateKeyToAccount(info.key);
  accountCache.set(contract, account);

  return account;
}

export function getOperatorWallet(contract: ContractName): WalletClient | null {
  if (walletCache.has(contract)) {
    return walletCache.get(contract)!;
  }

  const account = getOperatorAccount(contract);
  const info = getEnvKeyInfo(contract);

  if (!account || !info) {
    return null;
  }

  const wallet = createWalletClient({
    chain,
    account,
    transport: http(clientEnv.NEXT_PUBLIC_RPC_URL),
  });

  walletCache.set(contract, wallet);

  if (!warnedCache.has(contract)) {
    // eslint-disable-next-line no-console
    console.log(`[operator] ${contract} using operator ${account.address} (source: ${info.source})`);
    warnedCache.add(contract);
  }

  return wallet;
}

export function requireOperatorWallet(contract: ContractName): WalletClient {
  const wallet = getOperatorWallet(contract);
  if (!wallet) {
    throw new Error(`Operator wallet not configured for ${contract}`);
  }
  return wallet;
}

const OPERATOR_ROLE = keccak256(toBytes("OPERATOR_ROLE"));
const HAS_ROLE_ABI = [
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const;

/**
 * Verifies each configured operator wallet actually holds OPERATOR_ROLE on
 * the contract it's meant to sign for — call once at each worker's
 * startup. A misconfiguration here doesn't throw or block placing bets
 * (users never touch this code path), it just makes every operator-only
 * call (settleMarket, cancelMarket, voidBet, resolveRound, settleGame, …)
 * revert AccessControlUnauthorizedAccount forever, silently, buried one
 * log line per attempt per retry interval — exactly what happened to
 * BettingCore's operator role for an unknown stretch before anyone
 * noticed. This surfaces that class of misconfiguration loudly, once, at
 * boot, instead of leaving it to be found by a stuck-bet report.
 */
export async function verifyOperatorRoles(
  contracts: { name: ContractName; address: `0x${string}` }[],
): Promise<void> {
  const client = createPublicClient({ chain, transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });

  for (const { name, address } of contracts) {
    const account = getOperatorAccount(name);
    if (!account) {
      console.warn(`[operator] no key configured for ${name} — operator-only calls will no-op`);
      continue;
    }
    try {
      const has = await client.readContract({
        address,
        abi: HAS_ROLE_ABI,
        functionName: "hasRole",
        args: [OPERATOR_ROLE, account.address],
      });
      if (!has) {
        console.error(
          `[operator] CRITICAL: ${account.address} (configured for ${name}) does NOT hold OPERATOR_ROLE on ${address}. ` +
          `Every operator-only call on this contract will revert until this is granted — see packages/contracts/scripts for a grantRole example.`,
        );
      } else {
        console.log(`[operator] ${name}: OPERATOR_ROLE confirmed for ${account.address}`);
      }
    } catch (error) {
      console.error(`[operator] role check failed for ${name} at ${address}`, error);
    }
  }
}
