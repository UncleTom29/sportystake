/**
 * Shared "finish a hand" orchestration used by both
 * /api/casino/blackjack/deal (when the initial deal is itself a natural
 * blackjack — no hit/stand possible) and /api/casino/blackjack/action
 * (stand, or a hit that busts). Plays the dealer out if needed, evaluates
 * the rules-correct outcome, applies the ONE blackjack-specific solvency
 * lever (gating the 3:2 bonus, never the win itself — see below), settles
 * on-chain, and finalizes both DB rows.
 */
import { prisma } from "./db";
import { evaluateHand, playDealer, type HandOutcome } from "./blackjackEngine";
import { settleCasinoBetOnchain, getCasinoAvailableCapacity, SettlementError } from "./casinoOnchain";
import { logger } from "./logger";

export interface FinishedHand {
  outcome: HandOutcome;
  multiplier: number;
  bonusGated: boolean;
  playerCards: number[];
  dealerCards: number[];
  payoutUsdc: bigint;
  win: boolean;
  settleTxHash: string | null;
}

export async function finishBlackjackHand(params: {
  blackjackHandId: string;
  casinoBetId: string;
  requestId: `0x${string}`;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  stake: bigint;
  playerCards: number[];
  dealerCards: number[];
  cursor: number;
  playerBusted: boolean;
  fallbackTxHash: string;
}): Promise<FinishedHand> {
  let dealerCards = params.dealerCards;
  if (!params.playerBusted) {
    const played = playDealer(params.serverSeed, params.clientSeed, params.nonce, params.dealerCards, params.playerCards, params.cursor);
    dealerCards = played.cards;
  }

  const evaluated = params.playerBusted
    ? { outcome: "dealer_win" as HandOutcome, multiplier: 0 }
    : evaluateHand(params.playerCards, dealerCards);

  let multiplier = evaluated.multiplier;
  let bonusGated = false;

  // Gate ONLY the 3:2 bonus tier — never the win itself. Silently biasing
  // card draws to prevent a legitimate blackjack in the first place would
  // be a far more visible (and worse) form of rigging than adjusting an
  // abstract dice threshold, for a game whose rules everyone already
  // knows. A bankroll that can't sustain even a plain 1:1 win is a
  // capitalization problem for max-bet limits to prevent, not something
  // this engine papers over — the existing settleGame balance clamp stays
  // as the backstop for that residual case, same as every other game.
  if (evaluated.outcome === "player_blackjack") {
    const availableCapacity = await getCasinoAvailableCapacity(params.requestId);
    const fullBonusDeficit = (params.stake * 3n) / 2n; // profit at 2.5x
    if (fullBonusDeficit > availableCapacity) {
      multiplier = 2; // fall back to a plain 1:1 win
      bonusGated = true;
    }
  }

  const payoutUsdc = multiplier === 0 ? 0n : (params.stake * BigInt(Math.round(multiplier * 100))) / 100n;
  const randomResult = BigInt(Math.round(multiplier * 10_000));

  let settleTxHash: string | null = null;
  let finalPayout = payoutUsdc;
  try {
    const settlement = await settleCasinoBetOnchain(params.requestId, randomResult, payoutUsdc);
    if (settlement) {
      settleTxHash = settlement.txHash;
      finalPayout = settlement.actualPayout;
    }
  } catch (err) {
    if (err instanceof SettlementError && err.isAlreadySettled) {
      logger.error("[blackjack] REPLAY BLOCKED: BetAlreadySettled", { requestId: params.requestId });
      throw err;
    }
    logger.warn("[blackjack] on-chain settle delayed/failed — saving off-chain for reconciliation", { error: String(err) });
    settleTxHash = params.fallbackTxHash;
  }

  const finalWin = finalPayout > 0n;

  await prisma.$transaction([
    prisma.casinoBet.update({
      where: { id: params.casinoBetId },
      data: {
        status: finalWin ? "WON" : "LOST",
        payout: finalPayout,
        multiplierX100: Math.round(multiplier * 100),
        metadata: {
          outcome: evaluated.outcome,
          playerCards: params.playerCards,
          dealerCards,
          bonusGated,
        },
        txHash: settleTxHash ?? params.fallbackTxHash,
        resolvedAt: new Date(),
      },
    }),
    prisma.blackjackHand.update({
      where: { id: params.blackjackHandId },
      data: {
        dealerHand: { cards: dealerCards },
        status: "resolved",
      },
    }),
  ]);

  return {
    outcome: evaluated.outcome,
    multiplier,
    bonusGated,
    playerCards: params.playerCards,
    dealerCards,
    payoutUsdc: finalPayout,
    win: finalWin,
    settleTxHash,
  };
}
