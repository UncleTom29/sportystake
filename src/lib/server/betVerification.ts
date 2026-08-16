/**
 * Server-side verification for BettingCore writes. The client signs and
 * broadcasts via Circle, then hands the backend a bare `txHash` — routes
 * MUST re-fetch the receipt themselves and decode the event rather than
 * trusting any client-supplied betId/amount/outcome, the same trust
 * posture the Circle session route uses for wallet addresses.
 */
import { decodeErrorResult, decodeEventLog, type TransactionReceipt } from "viem";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { ApiError } from "@/lib/server/api-response";
import { bettingCoreAbi } from "../../../packages/sdk/src/contracts/abis/BettingCore";
import { liquidityPoolAbi } from "../../../packages/sdk/src/contracts/abis/LiquidityPool";

function bettingCoreAddress() {
  return clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;
}

// BettingCore calls into LiquidityPool internally (e.g. lockLiquidity on bet
// placement), so a revert can carry either contract's error selector even
// though the client only ever calls BettingCore directly.
const REVERT_ABI = [...bettingCoreAbi, ...liquidityPoolAbi];

/** Hand-written copy for reverts a bettor can actually cause/act on. Names
 *  not listed here still get decoded (see decodeRevertReason) — they just
 *  fall back to a de-camel-cased version of the error name. */
const FRIENDLY_REVERT_MESSAGES: Record<string, string> = {
  UtilizationCapExceeded: "This bet exceeds the liquidity pool's available capacity right now. Try a smaller stake.",
  InsufficientVirtualLiquidity: "The liquidity pool doesn't have enough capacity for this bet right now. Try a smaller stake.",
  OddsBelowSlippage: "Odds moved before this bet confirmed. Try again.",
  MarketClosed: "This market closed before the bet confirmed.",
  MarketNotOpen: "This market isn't open for betting right now.",
  MarketAlreadySettled: "This market has already been settled.",
  MarketAlreadyCancelled: "This market was cancelled.",
  AttestationExpired: "This odds quote expired before the bet confirmed. Try again.",
  InvalidOracleSignature: "This odds quote could not be verified. Try again.",
  DuplicateMarketInParlay: "A parlay can't include the same match twice.",
  TooFewLegs: "A parlay needs at least 2 legs.",
  TooManyBets: "Too many pending bets on this market. Try again shortly.",
  ReentrancyGuardReentrantCall: "Another transaction from this wallet is still in flight. Try again shortly.",
  EnforcedPause: "Betting is temporarily paused.",
};

/** camelCase/PascalCase error name -> "Camel Case Error Name". */
function humanizeErrorName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/**
 * Replays the exact failed call via eth_call at the same block to recover
 * the revert reason, then decodes it against BettingCore+LiquidityPool's
 * combined error ABI. Best-effort — returns null (falls back to a generic
 * message) if the tx can't be found, the replay itself fails to reproduce
 * the revert, or the selector isn't one we have listed.
 */
async function decodeRevertReason(txHash: `0x${string}`): Promise<string | null> {
  try {
    const client = publicClient();
    const tx = await client.getTransaction({ hash: txHash });
    if (!tx.to || tx.blockNumber === null) return null;
    await client.request({
      method: "eth_call",
      params: [
        { from: tx.from, to: tx.to, data: tx.input, value: `0x${tx.value.toString(16)}` },
        `0x${tx.blockNumber.toString(16)}`,
      ],
    });
    return null; // Replay didn't revert — nothing to decode.
  } catch (err) {
    const data = (err as { data?: string; cause?: { data?: string } })?.data
      ?? (err as { cause?: { data?: string } })?.cause?.data;
    if (!data || data === "0x") return null;
    try {
      const decoded = decodeErrorResult({ abi: REVERT_ABI, data: data as `0x${string}` });
      return FRIENDLY_REVERT_MESSAGES[decoded.errorName] ?? humanizeErrorName(decoded.errorName) + ".";
    } catch {
      return null; // Selector not in our (partial, verified) error list.
    }
  }
}

async function getConfirmedReceipt(txHash: `0x${string}`) {
  const receipt = await publicClient().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    const reason = await decodeRevertReason(txHash).catch(() => null);
    throw new ApiError("TransactionFailed", reason ?? "The on-chain transaction did not succeed", 409);
  }
  if (receipt.to?.toLowerCase() !== bettingCoreAddress().toLowerCase()) {
    throw new ApiError("WrongContract", "Transaction was not sent to BettingCore", 400);
  }
  return receipt;
}

function decodeBettingCoreLog(logs: TransactionReceipt["logs"], eventName: string) {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: bettingCoreAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === eventName) return decoded.args as Record<string, unknown>;
    } catch {
      // Not a BettingCore log (or not this event) — skip.
    }
  }
  return null;
}

export interface VerifiedBetPlacement {
  betId: `0x${string}`;
  marketId: `0x${string}`;
  bettor: `0x${string}`;
  outcome: number;
  amount: bigint;
  potentialPayout: bigint;
  oddsX1000: bigint;
}

/** Verifies a `placeBet` tx actually happened and was sent by `expectedBettor`. */
export async function verifyBetPlaced(txHash: `0x${string}`, expectedBettor: string): Promise<VerifiedBetPlacement> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = decodeBettingCoreLog(receipt.logs, "BetPlaced");
  if (!args) throw new ApiError("EventNotFound", "No BetPlaced event in this transaction", 400);
  const bettor = args.bettor as string;
  if (bettor.toLowerCase() !== expectedBettor.toLowerCase()) {
    throw new ApiError("BettorMismatch", "Transaction was not sent by the signed-in wallet", 403);
  }
  return {
    betId: args.betId as `0x${string}`,
    marketId: args.marketId as `0x${string}`,
    bettor: bettor as `0x${string}`,
    outcome: Number(args.outcome),
    amount: args.amount as bigint,
    potentialPayout: args.potentialPayout as bigint,
    oddsX1000: args.oddsX1000 as bigint,
  };
}

export interface VerifiedParlayPlacement {
  parlayId: `0x${string}`;
  bettor: `0x${string}`;
  marketIds: `0x${string}`[];
  outcomes: number[];
  stake: bigint;
  potentialPayout: bigint;
  combinedOddsX1000: bigint;
}

/** Verifies a `placeParlayBet` tx actually happened and was sent by `expectedBettor`. */
export async function verifyParlayPlaced(txHash: `0x${string}`, expectedBettor: string): Promise<VerifiedParlayPlacement> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = decodeBettingCoreLog(receipt.logs, "ParlayPlaced");
  if (!args) throw new ApiError("EventNotFound", "No ParlayPlaced event in this transaction", 400);
  const bettor = args.bettor as string;
  if (bettor.toLowerCase() !== expectedBettor.toLowerCase()) {
    throw new ApiError("BettorMismatch", "Transaction was not sent by the signed-in wallet", 403);
  }
  return {
    parlayId: args.parlayId as `0x${string}`,
    bettor: bettor as `0x${string}`,
    marketIds: [...(args.marketIds as `0x${string}`[])],
    outcomes: [...(args.outcomes as number[])].map(Number),
    stake: args.stake as bigint,
    potentialPayout: args.potentialPayout as bigint,
    combinedOddsX1000: args.combinedOddsX1000 as bigint,
  };
}

/** Verifies a `claimWinnings`/`claimRefund`/`claimParlayWinnings`/`claimParlayRefund` tx succeeded and matches the expected event + owner. */
export async function verifyClaim(
  txHash: `0x${string}`,
  eventName: "WinningsClaimed" | "RefundClaimed" | "ParlayWon" | "ParlayRefunded",
  expectedBettor: string,
): Promise<{ id: `0x${string}`; amount: bigint }> {
  const receipt = await getConfirmedReceipt(txHash);
  const args = decodeBettingCoreLog(receipt.logs, eventName);
  if (!args) throw new ApiError("EventNotFound", `No ${eventName} event in this transaction`, 400);
  const bettor = args.bettor as string;
  if (bettor.toLowerCase() !== expectedBettor.toLowerCase()) {
    throw new ApiError("BettorMismatch", "Transaction was not sent by the signed-in wallet", 403);
  }
  const id = (args.betId ?? args.parlayId) as `0x${string}`;
  const amount = (args.amount ?? args.payout) as bigint;
  return { id, amount };
}
