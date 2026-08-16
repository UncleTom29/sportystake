export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { ROLLOVER_MULTIPLIER } from "@/lib/server/bonusEngine";

export const runtime = "nodejs";

/**
 * GET /api/bonus/status
 * Returns user's Welcome Bonus status, virtual bonus balance, and 10x rollover progress.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  const user = await requireUser(req);
  if (!user) {
    return fail("Unauthorized", "Authentication required", 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      bonusOptIn: true,
      bonusBalance: true,
      initialBonusAmount: true,
      bonusRolloverWagered: true,
      bonusClaimedAt: true,
      bonusExpiresAt: true,
      bonusStatus: true,
    },
  });

  if (!dbUser) {
    return fail("NotFound", "User not found", 404);
  }

  const initialBonusUsdc = Number(dbUser.initialBonusAmount) / 1_000_000;
  const bonusBalanceUsdc = Number(dbUser.bonusBalance) / 1_000_000;
  const bonusRolloverWageredUsdc = Number(dbUser.bonusRolloverWagered) / 1_000_000;
  const rolloverTargetUsdc = initialBonusUsdc * ROLLOVER_MULTIPLIER;

  let rolloverProgressPercent = 0;
  if (rolloverTargetUsdc > 0) {
    rolloverProgressPercent = Math.min(100, Math.round((bonusRolloverWageredUsdc / rolloverTargetUsdc) * 100));
  }

  let daysRemaining = 0;
  if (dbUser.bonusExpiresAt) {
    const diffMs = new Date(dbUser.bonusExpiresAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return ok({
    status: {
      bonusOptIn: dbUser.bonusOptIn,
      bonusStatus: dbUser.bonusStatus,
      bonusBalanceUsdc,
      initialBonusUsdc,
      bonusRolloverWageredUsdc,
      rolloverTargetUsdc,
      rolloverProgressPercent,
      bonusExpiresAt: dbUser.bonusExpiresAt?.toISOString() || null,
      daysRemaining,
    },
  });
});
