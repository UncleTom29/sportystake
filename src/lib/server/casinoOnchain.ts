/**
 * Operator-keyed on-chain settlement for CasinoHouse — same construction
 * pattern as `src/workers/settlement.worker.ts`, but called synchronously
 * from within the `/api/casino/bet` request instead of a pub/sub worker,
 * since casino games resolve instantly (no real-world event to wait on).
 *
 * Returns:
 *   - `Hash` on successful settlement
 *   - `null`  when not configured (dev mode / contract not deployed)
 *   - Throws `SettlementError` on genuine on-chain failure
 */
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { casinoHouseAbi } from "../../../packages/sdk/src/contracts/abis/CasinoHouse";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const chain = {
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: "arc",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
} as const;

function casinoHouseAddress() {
  return clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS as `0x${string}`;
}

/** Thrown when on-chain settlement genuinely fails (revert, gas, etc.). */
export class SettlementError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SettlementError";
  }

  /** True when the contract reverted with BetAlreadySettled(). */
  get isAlreadySettled(): boolean {
    const msg = String(this.cause);
    return msg.includes("BetAlreadySettled") || msg.includes("0x");
  }
}

let warned = false;

/**
 * Settles a placed casino bet on-chain.
 *
 * @returns The settlement txHash on success, or `null` if the contract isn't
 *          deployed / operator key isn't configured (dev-mode graceful no-op).
 * @throws  {SettlementError} if the on-chain call genuinely fails — callers
 *          MUST treat this as a hard error and not persist the bet.
 */
export async function settleCasinoBetOnchain(
  requestId: `0x${string}`,
  randomResult: bigint,
  payout: bigint,
): Promise<Hash | null> {
  const address = casinoHouseAddress();
  const operatorKey =
    process.env.OPERATOR_PRIVATE_KEY_CASINO ??
    process.env.OPERATOR_PRIVATE_KEY;

  if (address === ZERO_ADDRESS || !operatorKey) {
    if (!warned) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn("[casino] CasinoHouse not deployed or OPERATOR_PRIVATE_KEY not set — settling off-chain only");
    }
    return null;
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  const wallet = createWalletClient({ chain, account, transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });

  try {
    const txHash = await wallet.writeContract({
      address,
      abi: casinoHouseAbi,
      functionName: "settleGame",
      args: [requestId, randomResult, payout],
    });
    await publicClient().waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    throw new SettlementError(
      `On-chain settlement failed for requestId ${requestId}`,
      err,
    );
  }
}
