import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { CasinoGame, CasinoStatus } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
    throw new ApiError("Forbidden", "Admin or Operator access required", 403);
  }

  const { searchParams } = new URL(req.url);
  const gameParam = searchParams.get("game") as CasinoGame | null;
  const statusParam = searchParams.get("status") as CasinoStatus | null;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const where = {
    ...(gameParam && Object.values(CasinoGame).includes(gameParam) ? { game: gameParam } : {}),
    ...(statusParam && Object.values(CasinoStatus).includes(statusParam) ? { status: statusParam } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.casinoBet.findMany({
      where,
      orderBy: { placedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, walletAddress: true, username: true } },
      },
    }),
    prisma.casinoBet.count({ where }),
  ]);

  return ok({
    items: items.map((b) => ({
      id: b.id,
      game: b.game,
      amount: (Number(b.amount) / 1e6).toFixed(2),
      multiplierX100: b.multiplierX100,
      payout: (Number(b.payout) / 1e6).toFixed(2),
      status: b.status,
      requestId: b.requestId,
      txHash: b.txHash,
      placedAt: b.placedAt.toISOString(),
      resolvedAt: b.resolvedAt?.toISOString() ?? null,
      user: {
        id: b.user.id,
        walletAddress: b.user.walletAddress as `0x${string}`,
        username: b.user.username ?? undefined,
      },
      metadata: b.metadata,
    })),
    total,
    limit,
    offset,
  });
});
