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
import { createWalletClient, decodeEventLog, http, type Hash, type TransactionReceipt } from "viem";
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

export interface CasinoSettlement {
  txHash: Hash;
  /** The payout `settleGame` actually transferred — decoded from the
   *  `GameSettled` event, NOT the `payout` this function was asked to
   *  settle for. These differ exactly when CasinoHouse's balance-clamp
   *  backstop fires; callers MUST persist/display this value, never the
   *  requested one, or a display can show more than a wallet received. */
  actualPayout: bigint;
}

/** Decodes `GameSettled` from a settleGame receipt — mirrors
 *  `crash-scheduler.worker.ts::decodePayouts`'s pattern for `PayoutCredited`. */
function decodeSettledPayout(logs: TransactionReceipt["logs"], requestId: `0x${string}`): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: casinoHouseAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "GameSettled" && (decoded.args.requestId as string).toLowerCase() === requestId.toLowerCase()) {
        return decoded.args.payout as bigint;
      }
    } catch { /* not this event */ }
  }
  return null;
}

/**
 * Settles a placed casino bet on-chain.
 *
 * @returns `{ txHash, actualPayout }` on success — `actualPayout` is what
 *          `settleGame` actually transferred, read back from `GameSettled`,
 *          which can be less than the requested `payout` if CasinoHouse's
 *          balance-clamp backstop fires. Returns `null` if the contract
 *          isn't deployed / operator key isn't configured (dev-mode
 *          graceful no-op).
 * @throws  {SettlementError} if the on-chain call genuinely fails, or if
 *          `GameSettled` is unexpectedly absent from a successful receipt —
 *          callers MUST treat this as a hard error and not persist the bet.
 */
export async function settleCasinoBetOnchain(
  requestId: `0x${string}`,
  randomResult: bigint,
  payout: bigint,
): Promise<CasinoSettlement | null> {
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
    const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });
    const actualPayout = decodeSettledPayout(receipt.logs, requestId);
    if (actualPayout === null) {
      throw new SettlementError(
        `settleGame receipt for requestId ${requestId} had no decodable GameSettled event`,
      );
    }
    return { txHash, actualPayout };
  } catch (err) {
    if (err instanceof SettlementError) throw err;
    throw new SettlementError(
      `On-chain settlement failed for requestId ${requestId}`,
      err,
    );
  }
}

/** Reads CasinoHouse's shared, admin-configurable RTP (bps, 9000 = 90%). */
export async function getCasinoRtpBps(): Promise<number> {
  const address = casinoHouseAddress();
  if (address === ZERO_ADDRESS) return 9000; // dev-mode default, matches the live default
  const bps = await publicClient().readContract({
    address,
    abi: casinoHouseAbi,
    functionName: "rtpBps",
  });
  return Number(bps);
}

/** Effectively-unconstrained sentinel for dev mode (no CasinoHouse deployed)
 *  — comfortably larger than any realistic USDC amount, so the pre-hoc
 *  capacity gate never fires when there's no real bankroll to model. */
const UNCONSTRAINED_CAPACITY = 10n ** 30n;

/**
 * Reads `requestId`'s real free capacity for its own resolution —
 * CasinoHouse's raw balance minus every OTHER currently-pending bet's
 * reserved exposure (this bet's own reservation excluded). Requires the
 * `placeCasinoBet` tx to already be mined (the on-chain counter it reads
 * only reflects bets ordered before that point) — callers should read this
 * after verifying the placement receipt, never before.
 */
export async function getCasinoAvailableCapacity(requestId: `0x${string}`): Promise<bigint> {
  const address = casinoHouseAddress();
  if (address === ZERO_ADDRESS) return UNCONSTRAINED_CAPACITY;
  return publicClient().readContract({
    address,
    abi: casinoHouseAbi,
    functionName: "availableCapacityFor",
    args: [requestId],
  });
}
