import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { getOnchainPoolStats } from "@/lib/server/chain";

export const runtime = "nodejs";

/** Markets where a bet's liability would push utilization of the shared pool > 80% (the on-chain cap). */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);

  const [onchain, markets] = await Promise.all([
    getOnchainPoolStats(),
    prisma.market.findMany({
      where: { status: { in: ["OPEN", "LIVE"] } },
      select: {
        id: true, homeTeam: true, awayTeam: true,
        bets: {
          where: { status: "PENDING" },
          select: { amount: true, potentialPayout: true },
        },
      },
      take: 500,
    }),
  ]);

  const effectiveCapacity = onchain.totalLiquidity + onchain.virtualLiquidity;

  const items = markets
    .map((m) => {
      const liability = m.bets.reduce((acc, b) => acc + b.potentialPayout - b.amount, 0n);
      if (effectiveCapacity === 0n || liability * 10n <= effectiveCapacity * 8n) return null;
      return {
        marketId: m.id,
        label: `${m.homeTeam} vs ${m.awayTeam}`,
        coverage: Number((liability * 10_000n) / effectiveCapacity) / 10_000,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.coverage - a.coverage);

  return ok({ items });
});
