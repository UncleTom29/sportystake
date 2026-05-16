import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { rollDice, spinSlots, playRoulette, playBlackjack, playBaccarat } from "@/lib/server/casino-sim";
import { store } from "@/lib/server/store";
import { readAuthFromRequest, checkRateLimit } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { shortId } from "@/lib/uid";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("game", [
  z.object({ game: z.literal("dice"), amount: z.string(), target: z.number().int().min(1).max(98), direction: z.enum(["over", "under"]) }),
  z.object({ game: z.literal("slots"), amount: z.string(), lines: z.number().int().min(1).max(20) }),
  z.object({ game: z.literal("roulette"), amount: z.string(), betType: z.string(), selection: z.union([z.number(), z.string()]) }),
  z.object({ game: z.literal("blackjack"), amount: z.string() }),
  z.object({ game: z.literal("baccarat"), amount: z.string(), bet: z.enum(["player", "banker", "tie"]) }),
]);

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to play", 401);
  checkRateLimit(`casino:${auth.sub}`, 60, 60_000);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid bet", 400, { details: parsed.error.issues });
  const body = parsed.data;
  const s = store();

  let outcome;
  switch (body.game) {
    case "dice":     outcome = rollDice(body.amount, body.target, body.direction); break;
    case "slots":    outcome = spinSlots(body.amount, body.lines); break;
    case "roulette": outcome = playRoulette(body.amount, { type: body.betType, selection: body.selection }); break;
    case "blackjack":outcome = playBlackjack(body.amount); break;
    case "baccarat": outcome = playBaccarat(body.amount, body.bet); break;
  }

  if (body.game === "dice") {
    s.diceHistory.unshift({
      id: `dice-${shortId()}`,
      userAddress: (s.users.find((u) => u.id === auth.sub)?.walletAddress) ?? ("0x0" as `0x${string}`),
      amount: body.amount,
      target: body.target,
      direction: body.direction,
      roll: (outcome.detail as { roll: number }).roll,
      win: outcome.win,
      payout: outcome.payout,
      createdAt: new Date().toISOString(),
    });
    s.diceHistory = s.diceHistory.slice(0, 200);
  }

  if (outcome.win) publish("casino:win", { userId: auth.sub, game: body.game, payout: outcome.payout });
  return ok({ outcome, game: body.game });
});
