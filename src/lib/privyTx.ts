"use client";

import {
  encodeFunctionData,
  parseAbiItem,
  type Address,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { erc20Abi } from "../../packages/sdk/src/contracts/abis/ERC20";
import { useWallet } from "@/lib/walletStore";
import { getPublicClient } from "@/lib/publicClient";

export class PrivyTxError extends Error {}

type AbiParamInput = string | number | bigint | boolean | AbiParamInput[];

let globalWalletClient: WalletClient | undefined;

export function setPrivyWalletClient(client: WalletClient | undefined) {
  globalWalletClient = client;
}

export function getPrivyWalletClient(): WalletClient | undefined {
  return globalWalletClient;
}

/** Reads caller's ERC20 allowance and, if short, signs an `approve` transaction first. */
export async function privyApproveIfNeeded(input: {
  token: Address;
  owner: Address;
  spender: Address;
  amount: bigint;
}): Promise<void> {
  const zero = "0x0000000000000000000000000000000000000000";
  if (
    !input.token ||
    input.token === zero ||
    !input.spender ||
    input.spender === zero ||
    input.token.toLowerCase() === input.spender.toLowerCase()
  ) {
    return;
  }

  try {
    const allowance = await getPublicClient().readContract({
      address: input.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [input.owner, input.spender],
    });
    if (allowance >= input.amount) return;

    await privyContractWrite({
      contractAddress: input.token,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [input.spender, input.amount],
    });
  } catch (err) {
    console.warn("[privyApproveIfNeeded] Allowance check or approve failed:", err);
  }
}

/**
 * Signs and executes an on-chain contract write using the signed-in user's Privy embedded wallet.
 * Resolves once the transaction receipt is confirmed on-chain.
 *
 * Only ever signs through the wallet client `PrivyAppProvider` builds from the user's embedded
 * wallet — never falls back to `window.ethereum`. A raw-injected-provider fallback would sign
 * with whatever account a browser extension happens to have selected (not necessarily the
 * authenticated user's wallet at all), and would pop that extension's UI for every bet/deposit,
 * defeating the point of an embedded wallet.
 */
export async function privyContractWrite(input: {
  contractAddress: Address;
  abiFunctionSignature?: string;
  abiParameters?: AbiParamInput[];
  callData?: `0x${string}`;
  /** Explicit gas ceiling — default 500_000n covers every current call site. */
  gas?: bigint;
}): Promise<TransactionReceipt> {
  const address = useWallet.getState().address;
  if (!address) throw new PrivyTxError("Not signed in — please sign in first");

  const walletClient = globalWalletClient;
  if (!walletClient) {
    throw new PrivyTxError("Wallet not ready yet — please wait a moment and try again");
  }

  let callData = input.callData;
  if (!callData && input.abiFunctionSignature) {
    try {
      const abiItem = parseAbiItem(`function ${input.abiFunctionSignature}`);
      callData = encodeFunctionData({
        abi: [abiItem],
        functionName: (abiItem as any).name,
        args: (input.abiParameters ?? []) as any,
      });
    } catch (err) {
      console.error("[privyContractWrite] Calldata encoding failed:", err);
      throw new PrivyTxError(`Failed to encode contract parameters: ${(err as Error).message}`);
    }
  }

  if (!callData) {
    throw new PrivyTxError("No function callData or signature provided for transaction");
  }

  // Sign with walletClient.account (the checksummed address Privy's embedded wallet was built
  // with in PrivyAppProvider.tsx) — never useWallet's `address`. That store's address gets
  // overwritten with the DB's lowercased copy as soon as the session-sync response lands (see
  // walletStore.setSession / privy/session/route.ts's `.toLowerCase()`), so by the time a user
  // places a bet it no longer matches the casing Privy's own backend has on file for this wallet.
  // Privy's `eth_sendTransaction` handler compares `from` against that record case-sensitively,
  // so a lowercased `from` gets rejected as EIP-1193 code 4100 ("has not been authorized by the
  // user") even though it's the same address — this was that bug, not a missing connect step.
  // Explicit gas, not estimated: this app has hit "intrinsic gas too low" from relying on
  // automatic eth_estimateGas. xero-protocol's Privy+viem setup (the pattern this mirrors) never
  // estimates either — every one of its writeContract calls hardcodes gas: 150000n, consistently,
  // with no fallback to estimation. A fixed ceiling costs nothing extra since only gas actually
  // consumed is charged, not the limit itself.
  try {
    const hash = await walletClient.sendTransaction({
      account: walletClient.account,
      to: input.contractAddress,
      data: callData,
      chain: walletClient.chain ?? null,
      gas: input.gas ?? 500_000n,
    } as any);

    return await getPublicClient().waitForTransactionReceipt({ hash });
  } catch (err) {
    console.error("[privyContractWrite] Transaction failed:", err);
    throw new PrivyTxError((err as Error).message || "Transaction signing or broadcast failed");
  }
}
