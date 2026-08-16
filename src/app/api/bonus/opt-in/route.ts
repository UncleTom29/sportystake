export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * POST /api/bonus/opt-in
 * Enables or toggles the Welcome Bonus opt-in status in user account settings.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const user = await requireUser(req);
  if (!user) {
    return fail("Unauthorized", "Authentication required", 401);
  }

  let body: { enabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // default to true if no body
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { bonusStatus: true },
  });

  if (dbUser && dbUser.bonusStatus !== "IDLE") {
    return fail("BadRequest", "Welcome bonus has already been activated or claimed", 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      bonusOptIn: enabled,
    },
    select: {
      bonusOptIn: true,
      bonusStatus: true,
    },
  });

  return ok({
    optIn: updated.bonusOptIn,
    message: enabled
      ? "Welcome Bonus enabled! Your first qualified on-chain wager will receive a 100% match up to $2,000 USDC."
      : "Welcome Bonus disabled.",
  });
});
