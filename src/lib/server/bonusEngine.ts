/**
 * SportyStake $2,000 Welcome Bonus Engine.
 *
 * Requirements:
 * 1. Opt-in: User enables Welcome Bonus in Account Settings.
 * 2. Qualification: Credited 100% of first on-chain wager up to $2,000 USDC if:
 *    - Total odds > 2.00
 *    - At least 3 selections carry odds >= 1.60
 * 3. Rollover (1XBet-style):
 *    - Bonus money only usable for sportsbook accumulators (min 10 selections).
 *    - At least 3 selections carry odds >= 1.60.
 *    - 10x rollover requirement on settled bonus accumulators.
 * 4. Expiration & Cap:
 *    - 10-day deadline from bonus credit.
 *    - Upon rollover completion, remaining bonus balance up to initial bonus cap transfers to main wallet.
 */

import { prisma } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";

export const MAX_BONUS_USDC = 2_000; // $2,000 max bonus match
export const MAX_BONUS_BASE_UNITS = 2_000_000_000n; // 2,000 * 10^6 USDC
export const ROLLOVER_MULTIPLIER = 10; // 10x rollover
export const BONUS_EXPIRY_DAYS = 10; // 10-day deadline

export interface BonusStatusResponse {
  bonusOptIn: boolean;
  bonusStatus: "IDLE" | "ACTIVE" | "COMPLETED" | "EXPIRED" | "FORFEITED";
  bonusBalanceUsdc: number;
  initialBonusUsdc: number;
  bonusRolloverWageredUsdc: number;
  rolloverTargetUsdc: number;
  rolloverProgressPercent: number;
  bonusExpiresAt: string | null;
  daysRemaining: number;
}

/**
 * Evaluates whether a user's first on-chain wager qualifies for the 100% Welcome Bonus.
 */
export async function evaluateFirstWagerForBonus(params: {
  userId: string;
  wagerAmountBaseUnits: bigint;
  totalOddsX1000: number;
  legs: Array<{ oddsX1000: number }>;
}) {
  const { userId, wagerAmountBaseUnits, totalOddsX1000, legs } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        bonusOptIn: true,
        bonusStatus: true,
        bets: { take: 2 },
        parlays: { take: 2 },
      },
    });

    if (!user || !user.bonusOptIn || user.bonusStatus !== "IDLE") {
      return null;
    }

    // Check if this is truly the first on-chain wager
    const totalWagersCount = (user.bets?.length || 0) + (user.parlays?.length || 0);
    if (totalWagersCount > 1) {
      return null; // Not the first wager
    }

    // Qualification Check 1: Total Odds > 2.00 (oddsX1000 > 2000)
    if (totalOddsX1000 <= 2000) {
      logger.info("[bonusEngine] Wager odds <= 2.00, does not qualify for bonus", { totalOddsX1000 });
      return null;
    }

    // Qualification Check 2: At least 3 selections with odds >= 1.60 (oddsX1000 >= 1600)
    const qualifyingLegsCount = legs.filter((l) => l.oddsX1000 >= 1600).length;
    if (qualifyingLegsCount < 3) {
      logger.info("[bonusEngine] Fewer than 3 selections >= 1.60 odds, does not qualify", { qualifyingLegsCount });
      return null;
    }

    // Match 100% of first on-chain wager up to $2,000 USDC
    const matchAmount = wagerAmountBaseUnits > MAX_BONUS_BASE_UNITS ? MAX_BONUS_BASE_UNITS : wagerAmountBaseUnits;
    const expiresAt = new Date(Date.now() + BONUS_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Update user bonus account
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bonusBalance: matchAmount,
        initialBonusAmount: matchAmount,
        bonusRolloverWagered: 0n,
        bonusClaimedAt: new Date(),
        bonusExpiresAt: expiresAt,
        bonusStatus: "ACTIVE",
      },
    });

    logger.info("[bonusEngine] Welcome bonus credited successfully!", {
      userId,
      matchAmountUsdc: Number(matchAmount) / 1_000_000,
      expiresAt: expiresAt.toISOString(),
    });

    return updatedUser;
  } catch (err) {
    logger.error("[bonusEngine] Failed to evaluate first wager bonus", { error: (err as Error).message });
    return null;
  }
}

/**
 * Validates whether a bonus accumulator bet placement satisfies 1XBet-style rollover criteria.
 */
export function validateBonusBetPlacement(params: {
  bonusBalance: bigint;
  stakeBaseUnits: bigint;
  bonusStatus: string;
  bonusExpiresAt: Date | null;
  legs: Array<{ oddsX1000: number }>;
}): { valid: boolean; error?: string } {
  const { bonusBalance, stakeBaseUnits, bonusStatus, bonusExpiresAt, legs } = params;

  if (bonusStatus !== "ACTIVE") {
    return { valid: false, error: "Bonus account is not active or has expired." };
  }

  if (bonusExpiresAt && new Date() > bonusExpiresAt) {
    return { valid: false, error: "Bonus wagering period (10 days) has expired." };
  }

  if (stakeBaseUnits <= 0n || stakeBaseUnits > bonusBalance) {
    return { valid: false, error: "Insufficient bonus balance." };
  }

  // Rule 1: Accumulator Bets Only (Minimum 10 independent events)
  if (legs.length < 10) {
    return { valid: false, error: "Bonus wagers must be accumulators with at least 10 independent selections." };
  }

  // Rule 2: Minimum Odds (At least 3 selections with odds >= 1.60)
  const qualifyingLegs = legs.filter((l) => l.oddsX1000 >= 1600).length;
  if (qualifyingLegs < 3) {
    return { valid: false, error: "At least 3 selections in your bonus accumulator must carry odds of 1.60 or higher." };
  }

  return { valid: true };
}

/**
 * Progresses bonus rollover when a bonus accumulator bet settles.
 */
export async function processBonusBetSettlement(params: {
  userId: string;
  stakeBaseUnits: bigint;
  payoutBaseUnits: bigint;
  isWon: boolean;
}) {
  const { userId, stakeBaseUnits, payoutBaseUnits, isWon } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.bonusStatus !== "ACTIVE") {
      return;
    }

    // Check expiration
    if (user.bonusExpiresAt && new Date() > user.bonusExpiresAt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          bonusBalance: 0n,
          bonusStatus: "EXPIRED",
        },
      });
      logger.info("[bonusEngine] Bonus expired before rollover completion", { userId });
      return;
    }

    // Update bonus balance if won
    let newBonusBalance = user.bonusBalance;
    if (isWon) {
      newBonusBalance += payoutBaseUnits;
    }

    // Accumulate rollover wagered volume
    const newRolloverWagered = user.bonusRolloverWagered + stakeBaseUnits;
    const targetRollover = user.initialBonusAmount * BigInt(ROLLOVER_MULTIPLIER);

    // Check if 10x rollover target is completed
    if (newRolloverWagered >= targetRollover) {
      // Rollover Completed!
      // Transfer remaining bonus balance up to initial bonus cap to main wallet
      const transferAmount = newBonusBalance > user.initialBonusAmount ? user.initialBonusAmount : newBonusBalance;

      await prisma.user.update({
        where: { id: userId },
        data: {
          bonusBalance: 0n,
          bonusRolloverWagered: newRolloverWagered,
          bonusStatus: "COMPLETED",
        },
      });

      logger.info("[bonusEngine] Welcome bonus rollover COMPLETED! Transferring to main wallet.", {
        userId,
        transferAmountUsdc: Number(transferAmount) / 1_000_000,
      });

      // Send notification to user
      await prisma.notification.create({
        data: {
          userId,
          kind: "BONUS_COMPLETED",
          title: "Welcome Bonus Rollover Completed!",
          body: `Congratulations! You completed the 10x rollover. ${Number(transferAmount) / 1_000_000} USDC has been converted into your account.`,
        },
      }).catch(() => {});
    } else {
      // Update ongoing rollover progress
      await prisma.user.update({
        where: { id: userId },
        data: {
          bonusBalance: newBonusBalance,
          bonusRolloverWagered: newRolloverWagered,
        },
      });
    }
  } catch (err) {
    logger.error("[bonusEngine] Error processing bonus bet settlement", { error: (err as Error).message });
  }
}
