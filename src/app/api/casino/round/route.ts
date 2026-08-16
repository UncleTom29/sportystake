import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { getActiveCasinoRound, getActiveCasinoRoundAsync, placePoolCasinoBet } from "@/lib/server/casinoRoundEngine";
import { requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async () => {
  const round = await getActiveCasinoRoundAsync();
  return ok(round);
});

export const POST = withRequestId(async (req: NextRequest) => {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const { game = "DICE", amount } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return fail("InvalidAmount", "Deposit amount must be greater than zero", 400);
    }

    const bet = placePoolCasinoBet(user.id, user.username || `User_${user.walletAddress.slice(0, 6)}`, game, numAmount);
    const updatedRound = getActiveCasinoRound();

    return ok({ bet, round: updatedRound });
  } catch (e) {
    return fail("Unauthorized", (e as Error).message, 401);
  }
});
