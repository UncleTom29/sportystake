import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { usdcToString } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

/**
 * The signed-in user's casino bet history, all games. Returns up to 50 rows
 * by default; filterable by ?game=DICE etc.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);

  const sp = req.nextUrl.searchParams;
  const game = sp.get("game") as "CRASH" | "DICE" | "SLOTS" | "BLACKJACK" | "ROULETTE" | "BACCARAT" | null;
  const limit = Math.min(100, Number(sp.get("limit") ?? "50"));

  const rows = await prisma.casinoBet.findMany({
    where: { userId: auth.sub, ...(game ? { game } : {}) },
    orderBy: { placedAt: "desc" },
    take: limit,
  });

  const items = rows.map((r) => ({
    id: r.id,
    game: r.game,
    amount: usdcToString(r.amount),
    payout: usdcToString(r.payout),
    multiplierX100: r.multiplierX100 ?? 0,
    status: r.status,
    placedAt: r.placedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    fairness: r.seedServerHash
      ? {
          serverSeedHash: r.seedServerHash,
          serverSeed: r.seedServer ?? null,
          clientSeed: r.seedClient ?? null,
          nonce: r.nonce,
        }
      : null,
    metadata: r.metadata ?? null,
  }));

  return ok({ items });
});
