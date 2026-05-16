import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store, utils } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const s = store();
  const items = s.markets
    .filter((m) => {
      const tvl = utils.fromUsdc(m.poolTvl);
      const lock = utils.fromUsdc(m.poolLocked);
      return tvl > 0n && lock * 10n > tvl * 8n;
    })
    .map((m) => ({
      marketId: m.id,
      label: `${m.homeTeam} vs ${m.awayTeam}`,
      coverage: Number((utils.fromUsdc(m.poolLocked) * 10000n) / utils.fromUsdc(m.poolTvl)) / 10000,
    }));
  return ok({ items });
});
