/**
 * Shared settlement logic — how a market type resolves from a final score,
 * and how we talk to the chain to actually settle a market. Used by the
 * automated oracle-driven path (settlement.worker.ts,
 * settleResolvedPolymarketMarkets) and the admin manual-settle route, so
 * each of those only has to be gotten right once.
 *
 * Why this exists: a `Market` row is one fixture/event, but carries bets
 * across every market type offered on it (1X2, totals, BTTS, asian
 * handicap, ...). BettingCore.settleMarket takes exactly one
 * `winningOutcome` integer per call — it has no concept of market type at
 * all, and can only be called once per market (it reverts on a second
 * call). So every market-type's winners have to be resolved and unioned
 * into a single winningBetIds list *before* that one call happens, or
 * whatever's left over is stuck PENDING forever with no valid claim path.
 */
import {
  createPublicClient,
  http,
  type Hash,
  type Address,
} from "viem";
import { clientEnv } from "@/lib/env";
import { getOperatorWallet } from "@/lib/server/operatorWallet";
import { logger } from "@/lib/server/logger";
import { BetsRepo } from "@/lib/server/repos/bets.repo";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { bettingCoreAbi } from "../../../packages/sdk/src/contracts/abis/BettingCore";

const MAX_SETTLE_BATCH = 500;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── Per-market-type outcome resolution ────────────────────────────────────

/** 1X2: 0=Home, 1=Draw, 2=Away. */
function resolve1X2(homeScore: number, awayScore: number): number {
  if (homeScore > awayScore) return 0;
  if (homeScore < awayScore) return 2;
  return 1;
}

/**
 * Outcome index is deterministic from odds.normalizer.ts's normalizeTotals /
 * normalizeBtts, which always push the first-listed side (Over, Yes) before
 * the second (Under, No) whenever a snapshot has both — real bookmaker data
 * always quotes both sides of these markets. 0=Over/Yes, 1=Under/No.
 */
function resolveOverUnder(line: number, homeScore: number, awayScore: number): number {
  return homeScore + awayScore > line ? 0 : 1;
}

function resolveBtts(homeScore: number, awayScore: number): number {
  return homeScore > 0 && awayScore > 0 ? 0 : 1;
}

/**
 * over_under_<line*10> — matches xbet_full.py's `_line_suffix` encoding
 * exactly (e.g. "over_under_5" = 0.5, "over_under_25" = 2.5). Generic
 * because the scraper emits one entry per line 1xbet actually offers, not
 * a fixed set — this used to hardcode only 15/25/35, silently stranding
 * any other line (0.5, 4.5, 5.5, 6.5, ...) as an unresolvable bet, the same
 * "displayed and bettable but can never settle" shape already fixed for
 * double_chance.
 */
function resolveOverUnderKey(marketType: string, homeScore: number, awayScore: number): number | null {
  const match = /^over_under_(\d+)$/.exec(marketType);
  if (!match) return null;
  const line = Number.parseInt(match[1], 10) / 10;
  return resolveOverUnder(line, homeScore, awayScore);
}

/**
 * Score-derivable market types only — null for anything needing per-bet
 * resolution (asian_handicap, double_chance) or any type this app doesn't
 * actually price (see scrape.normalizer.ts for what's real).
 */
export function resolveScoreBasedOutcome(marketType: string, homeScore: number, awayScore: number): number | null {
  if (marketType === "1X2") return resolve1X2(homeScore, awayScore);
  if (marketType === "btts") return resolveBtts(homeScore, awayScore);
  return resolveOverUnderKey(marketType, homeScore, awayScore);
}

export type AsianHandicapVerdict = "win" | "lose" | "push" | "unsupported";

/**
 * Asian handicap needs per-bet resolution, not one winning outcome per
 * market — different bets can sit at different lines depending on when they
 * were placed. The line isn't its own column, so it's recovered from the
 * selection label odds.normalizer.ts's normalizeAsianHandicap produces at
 * odds-capture time ("Home (-1.5)" / "Away (-1.5)") — this and that
 * normalizer have to keep agreeing on that exact format.
 *
 * Quarter lines (e.g. -0.25, -0.75) split a bet's stake across two adjacent
 * half-lines under true Asian handicap rules. BettingCore can only fully
 * win, fully lose, or fully void (voidBet) a given betId — it has no partial
 * settlement — so quarter lines come back "unsupported" for manual admin
 * resolution rather than being approximated.
 */
export function resolveAsianHandicapBet(selectionLabel: string, homeScore: number, awayScore: number): AsianHandicapVerdict {
  const match = /^(Home|Away) \(([-+]?\d+(?:\.\d+)?)\)$/.exec(selectionLabel.trim());
  if (!match) return "unsupported";
  const side = match[1] as "Home" | "Away";
  const line = Number.parseFloat(match[2]);
  if (!Number.isFinite(line)) return "unsupported";
  if (Math.abs(line * 2 - Math.round(line * 2)) > 1e-9) return "unsupported"; // quarter line

  const adjustedHomeMargin = homeScore - awayScore + line;
  if (Math.abs(adjustedHomeMargin) < 1e-9) return "push";
  const homeCovers = adjustedHomeMargin > 0;
  if (side === "Home") return homeCovers ? "win" : "lose";
  return homeCovers ? "lose" : "win";
}

export type DoubleChanceVerdict = "win" | "lose" | "unsupported";

/**
 * Double chance needs per-bet resolution like asian_handicap, but for a
 * different reason: a single winningOutcome index can't express it, because
 * TWO of the three combos ("1X", "12", "X2") win on every match — only one
 * ever loses. Resolved from the selection label itself ("1X"/"12"/"X2",
 * exactly as xbet_full.py's _build_double_chance labels each outcome and
 * odds.normalizer.ts/scrape.normalizer.ts pass through unchanged), not the
 * bet's numeric `outcome` index — that index is the array position among
 * whichever combos survived a >1.0 odds filter at capture time, which isn't
 * guaranteed to stay at a fixed 0/1/2 the way this label always does.
 */
export function resolveDoubleChanceBet(selectionLabel: string, homeScore: number, awayScore: number): DoubleChanceVerdict {
  const label = selectionLabel.trim().toUpperCase();
  const result = homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X";
  if (label === "1X") return result === "1" || result === "X" ? "win" : "lose";
  if (label === "12") return result === "1" || result === "2" ? "win" : "lose";
  if (label === "X2") return result === "X" || result === "2" ? "win" : "lose";
  return "unsupported";
}

// ─── Aggregating a full market's settlement ────────────────────────────────

export interface MarketSettlementPlan {
  winningBetIds: string[];
  /** Pushes / unsupported bets to refund via voidBet — not won, not lost. */
  voidedBetIds: string[];
  totalPayout: bigint;
  /** marketType (or "marketType:betId" for per-bet cases) the resolver couldn't handle — left PENDING, needs manual admin action via voidBet or a follow-up. */
  unresolved: string[];
}

/** Plans settlement for every pending bet on a market from its final score, across every market type present. */
export async function planScoreBasedSettlement(
  marketId: string,
  homeScore: number,
  awayScore: number,
): Promise<MarketSettlementPlan> {
  const pending = await BetsRepo.pendingByMarket(marketId);
  const winningBetIds: string[] = [];
  const voidedBetIds: string[] = [];
  const unresolved = new Set<string>();
  let totalPayout = 0n;

  const byType = new Map<string, typeof pending>();
  for (const b of pending) {
    const list = byType.get(b.marketType) ?? [];
    list.push(b);
    byType.set(b.marketType, list);
  }

  for (const [marketType, bets] of byType) {
    if (marketType === "asian_handicap") {
      for (const b of bets) {
        const verdict = resolveAsianHandicapBet(b.selectionLabel, homeScore, awayScore);
        if (verdict === "win") {
          winningBetIds.push(b.id);
          totalPayout += b.potentialPayout;
        } else if (verdict === "push") {
          voidedBetIds.push(b.id);
        } else if (verdict === "unsupported") {
          unresolved.add(`asian_handicap:${b.id}`);
        }
        // "lose" needs no action here — reconcileSettlement marks anything
        // left PENDING on this market as LOST by omission.
      }
      continue;
    }

    if (marketType === "double_chance") {
      for (const b of bets) {
        const verdict = resolveDoubleChanceBet(b.selectionLabel, homeScore, awayScore);
        if (verdict === "win") {
          winningBetIds.push(b.id);
          totalPayout += b.potentialPayout;
        } else if (verdict === "unsupported") {
          unresolved.add(`double_chance:${b.id}`);
        }
        // "lose" needs no action here — same as asian_handicap above.
      }
      continue;
    }

    const winningOutcome = resolveScoreBasedOutcome(marketType, homeScore, awayScore);
    if (winningOutcome === null) {
      unresolved.add(marketType);
      continue;
    }
    for (const b of bets) {
      if (b.outcome === winningOutcome) {
        winningBetIds.push(b.id);
        totalPayout += b.potentialPayout;
      }
    }
  }

  return { winningBetIds, voidedBetIds, totalPayout, unresolved: [...unresolved] };
}

/**
 * Same shape, for markets settled by one explicit winning outcome instead
 * of a score — prediction markets, which have no home/away score concept
 * at all and resolve via Polymarket's own outcome instead.
 */
export async function planDirectOutcomeSettlement(
  marketId: string,
  marketType: string,
  winningOutcome: number,
): Promise<MarketSettlementPlan> {
  const pending = await BetsRepo.pendingByMarket(marketId);
  const winningBetIds: string[] = [];
  const unresolved: string[] = [];
  let totalPayout = 0n;
  for (const b of pending) {
    if (b.marketType !== marketType) {
      unresolved.push(`${b.marketType}:${b.id}`);
      continue;
    }
    if (b.outcome === winningOutcome) {
      winningBetIds.push(b.id);
      totalPayout += b.potentialPayout;
    }
  }
  return { winningBetIds, voidedBetIds: [], totalPayout, unresolved };
}

// ─── On-chain execution (operator-keyed) ───────────────────────────────────

type OperatorClients = {
  wallet: NonNullable<ReturnType<typeof getOperatorWallet>>;
  publicClient: ReturnType<typeof createPublicClient>;
};
let operatorClients: OperatorClients | null | undefined;

function getOperatorClients(): OperatorClients | null {
  if (operatorClients !== undefined) return operatorClients;
  // Fix #3: use per-contract operator wallet
  const wallet = getOperatorWallet("bettingCore");
  if (!wallet) {
    operatorClients = null;
    return null;
  }
  const chain = {
    id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
    name: "arc",
    nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
    rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
  } as const;
  operatorClients = {
    wallet,
    publicClient: createPublicClient({ chain, transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) }),
  };
  return operatorClients;
}

export interface SettleMarketInput {
  marketId: string;
  /** Stored on the Market row for display — settlement correctness comes entirely from `plan`, not this value. */
  primaryWinningOutcome: number;
  plan: MarketSettlementPlan;
}

/**
 * Executes a full settlement pass for one market: voids pushes/unsupported
 * bets first — so BettingCore.settleMarket's totalBetAmount accounting
 * doesn't count a stake that's already been refunded as still available to
 * the pool — then settles the market with the remaining winners in one
 * call. Reconciles Postgres regardless of whether an on-chain call actually
 * ran (no operator key configured, or contract not deployed, both no-op
 * the chain call, same as the rest of this app's dev-mode fallbacks).
 */
export async function executeMarketSettlement(
  input: SettleMarketInput,
): Promise<{ settleTxHash: Hash | null; voidTxHashes: Hash[] }> {
  const { marketId, primaryWinningOutcome, plan } = input;
  const voidTxHashes: Hash[] = [];
  let settleTxHash: Hash | null = null;

  const bettingCoreAddress = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as Address;
  const clients = getOperatorClients();

  if (clients && bettingCoreAddress !== ZERO_ADDRESS) {
    // Gap 1: incremental voiding with per-bet resume capability
    for (const betId of plan.voidedBetIds) {
      // Check if Postgres already marked this bet as CANCELLED (from a prior run)
      const existing = await BetsRepo.byId(betId);
      if (existing && existing.status === "CANCELLED") {
        logger.info("[settlement] Bet already marked CANCELLED in DB, skipping voidBet", { betId });
        continue;
      }

      try {
        const hash = await clients.wallet.writeContract({
          address: bettingCoreAddress,
          abi: bettingCoreAbi,
          functionName: "voidBet",
          args: [betId as `0x${string}`],
          chain: clients.wallet.chain,
          account: clients.wallet.account!,
        });
        await clients.publicClient.waitForTransactionReceipt({ hash });
        voidTxHashes.push(hash);
        // Incremental Postgres reconciliation: mark cancelled immediately upon on-chain success
        await BetsRepo.setStatus(betId, "CANCELLED");
        logger.info("[settlement] Voided bet on-chain & updated DB", { betId, hash });
      } catch (err) {
        const msg = String(err);
        if (msg.includes("BetNotRefundable") || msg.includes("MarketAlreadySettled") || msg.includes("BetNotFound")) {
          logger.warn("[settlement] voidBet skipped (already voided or market settled on-chain)", { betId, error: msg.split("\n")[0] });
          await BetsRepo.setStatus(betId, "CANCELLED");
        } else {
          logger.error("[settlement] voidBet failed for bet", { betId, error: msg });
        }
      }
    }

    if (plan.winningBetIds.length > MAX_SETTLE_BATCH) {
      throw new Error(
        `${plan.winningBetIds.length} winning bets exceeds MAX_SETTLE_BATCH (${MAX_SETTLE_BATCH}) for market ${marketId}`,
      );
    }

    try {
      settleTxHash = await clients.wallet.writeContract({
        address: bettingCoreAddress,
        abi: bettingCoreAbi,
        functionName: "settleMarket",
        args: [
          marketId as `0x${string}`,
          primaryWinningOutcome,
          plan.winningBetIds as `0x${string}`[],
          plan.totalPayout,
        ],
        chain: clients.wallet.chain,
        account: clients.wallet.account!,
      });
      await clients.publicClient.waitForTransactionReceipt({ hash: settleTxHash });
      logger.info("[settlement] Market settled on-chain", { marketId, hash: settleTxHash });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("MarketAlreadySettled")) {
        logger.info("[settlement] Market already settled on-chain, proceeding to DB reconciliation", { marketId });
      } else if (msg.includes("MarketNotFound")) {
        // Markets only get registered on-chain lazily, on their first real
        // bet (see placeBetWithAttestation) — one with zero bets (common
        // for prediction markets nobody wagered on) never exists on-chain
        // at all, so there's nothing for settleMarket to act on. Not an
        // error: proceed straight to Postgres reconciliation, which is a
        // no-op here too since plan.winningBetIds/voidedBetIds are empty
        // for a market nobody bet on.
        logger.info("[settlement] Market was never registered on-chain (no bets placed) — DB-only settlement", { marketId });
      } else {
        logger.error("[settlement] settleMarket on-chain call failed", { marketId, error: msg });
        throw err;
      }
    }
  } else {
    logger.warn(`[settlement] operator key or BettingCore address not configured — recording market ${marketId} off-chain only`);
  }

  await BetsRepo.reconcileSettlement(marketId, plan.winningBetIds, plan.voidedBetIds);
  await MarketsRepo.setStatus(marketId, "SETTLED", primaryWinningOutcome);

  // Gap 3: Paging / Critical alert for unresolved settlement items
  if (plan.unresolved.length > 0) {
    logger.critical(
      "[settlement] UNRESOLVED BETS: market settled with unresolved bets requiring manual intervention",
      {
        marketId,
        unresolvedCount: plan.unresolved.length,
        unresolvedBetIds: plan.unresolved,
      },
    );
  }

  return { settleTxHash, voidTxHashes };
}

/**
 * Cancels a market on-chain and reconciles Postgres. Same operator-key /
 * not-deployed graceful no-op as executeMarketSettlement above.
 *
 * `BettingCore.cancelMarket` releases the market's entire liquidity lock as
 * one zero-net settlement (`reportMarketResult(marketId, totalBetAmount,
 * totalBetAmount)`) — each bettor then calls `claimRefund` individually,
 * which requires the market to be `Cancelled` *on-chain*. Before this, the
 * admin cancel route only ever updated Postgres, so a market shown as
 * "cancelled" in the app was still `Open` in the contract's own state —
 * `claimRefund` would have reverted with `MarketNotCancelled` for every
 * bettor on it, same unclaimable-funds shape as the settlement bug above.
 */
export async function cancelMarketOnchain(marketId: string): Promise<{ cancelTxHash: Hash | null }> {
  const bettingCoreAddress = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as Address;
  const clients = getOperatorClients();

  let cancelTxHash: Hash | null = null;
  if (clients && bettingCoreAddress !== ZERO_ADDRESS) {
    try {
      cancelTxHash = await clients.wallet.writeContract({
        address: bettingCoreAddress,
        abi: bettingCoreAbi,
        functionName: "cancelMarket",
        args: [marketId as `0x${string}`],
        chain: clients.wallet.chain,
        account: clients.wallet.account!,
      });
      await clients.publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
    } catch (err) {
      const msg = String(err);
      // Same lazy-registration case as executeMarketSettlement above — a
      // market with zero real bets was never created on-chain, so there's
      // nothing there to cancel. Callers that sweep in bulk (see
      // oracle-sync.worker.ts's recoverStuckSportsMarkets) should already
      // be filtering these out before ever reaching here, but this stays
      // as the correctness backstop regardless of caller.
      if (msg.includes("MarketNotFound") || msg.includes("MarketAlreadyCancelled")) {
        cancelTxHash = null;
      } else {
        throw err;
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[settlement] operator key or BettingCore address not configured — cancelling market ${marketId} off-chain only`);
  }

  await MarketsRepo.setStatus(marketId, "CANCELLED");
  await BetsRepo.cancelMarketBets(marketId);

  return { cancelTxHash };
}
