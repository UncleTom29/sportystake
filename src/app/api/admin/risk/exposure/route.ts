import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const s = store();
  const items = s.markets
    .filter((m) => m.status === "OPEN" || m.status === "LIVE")
    .map((m) => {
      const totalBet = utils.fromUsdc(m.poolBetVolume);
      const maxLiability = utils.fromUsdc(m.poolLocked);
      const tvl = utils.fromUsdc(m.poolTvl);
      const coverageRatio = tvl > 0n ? Number((maxLiability * 10000n) / tvl) / 10000 : 0;
      const riskLevel: "safe" | "warning" | "critical" =
        coverageRatio > 0.95 ? "critical" : coverageRatio > 0.8 ? "warning" : "safe";
      return {
        marketId: m.id, label: `${m.homeTeam} vs ${m.awayTeam}`,
        totalBetAmount: m.poolBetVolume, maxLiability: m.poolLocked, poolTvl: m.poolTvl,
        coverageRatio, riskLevel,
        totalBet: utils.toUsdc(totalBet),
      };
    })
    .sort((a, b) => b.coverageRatio - a.coverageRatio);
  return ok({ items });
});
