export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { validateBonusBetPlacement } from "@/lib/server/bonusEngine";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

interface BonusSelection {
  matchId: string;
  marketType: string;
  outcome: number;
  selectionLabel: string;
  oddsX1000: number;
}

/**
 * POST /api/bonus/place-bet
 * Places an accumulator bet using the user's virtual bonus balance.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const user = await requireUser(req);
  if (!user) {
    return fail("Unauthorized", "Authentication required", 401);
  }

  let body: { selections?: BonusSelection[]; stakeUsdc?: number };
  try {
    body = await req.json();
  } catch {
    return fail("BadRequest", "Invalid JSON body", 400);
  }

  const { selections, stakeUsdc } = body;
  if (!Array.isArray(selections) || selections.length === 0) {
    return fail("BadRequest", "At least 1 selection required", 400);
  }

  if (typeof stakeUsdc !== "number" || stakeUsdc <= 0) {
    return fail("BadRequest", "Invalid stake amount", 400);
  }

  const stakeBaseUnits = BigInt(Math.round(stakeUsdc * 1_000_000));

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      bonusBalance: true,
      bonusStatus: true,
      bonusExpiresAt: true,
    },
  });

  if (!dbUser) {
    return fail("NotFound", "User not found", 404);
  }

  // Validate bonus bet placement rules
  const validation = validateBonusBetPlacement({
    bonusBalance: dbUser.bonusBalance,
    stakeBaseUnits,
    bonusStatus: dbUser.bonusStatus,
    bonusExpiresAt: dbUser.bonusExpiresAt,
    legs: selections.map((s) => ({ oddsX1000: s.oddsX1000 })),
  });

  if (!validation.valid) {
    return fail("BadRequest", validation.error || "Invalid bonus bet placement", 400);
  }

  // Calculate combined odds
  const combinedOddsFloat = selections.reduce((acc, s) => acc * (s.oddsX1000 / 1000), 1);
  const combinedOddsX1000 = BigInt(Math.round(combinedOddsFloat * 1000));
  const potentialPayoutBaseUnits = BigInt(Math.round(Number(stakeBaseUnits) * combinedOddsFloat));

  const parlayId = `0x${randomBytes(32).toString("hex")}`;

  // Execute database transaction: deduct bonus balance and record bonus parlay
  const [parlay] = await prisma.$transaction([
    prisma.parlay.create({
      data: {
        id: parlayId,
        userId: user.id,
        stake: stakeBaseUnits,
        combinedOddsX1000,
        potentialPayout: potentialPayoutBaseUnits,
        status: "PENDING",
        isBonusBet: true,
        legs: {
          create: selections.map((s) => ({
            marketId: s.matchId,
            outcome: s.outcome,
            selectionLabel: s.selectionLabel,
            oddsX1000: s.oddsX1000,
            result: "PENDING",
          })),
        },
      },
      include: {
        legs: true,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        bonusBalance: dbUser.bonusBalance - stakeBaseUnits,
      },
    }),
  ]);

  return ok({
    parlay: {
      id: parlay.id,
      stakeUsdc,
      combinedOdds: combinedOddsFloat,
      potentialPayoutUsdc: Number(potentialPayoutBaseUnits) / 1_000_000,
      isBonusBet: true,
      legCount: parlay.legs.length,
    },
    remainingBonusBalanceUsdc: Number(dbUser.bonusBalance - stakeBaseUnits) / 1_000_000,
    message: "Bonus accumulator wager placed successfully!",
  });
});
