export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { maybeAttestMarket } from "@/lib/server/marketAttestation";

export const runtime = "nodejs";

export const GET = withRequestId(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const m = await MarketsRepo.byId(id);
    if (!m) return fail("NotFound", "Market not found", 404);
    m.attestation = await maybeAttestMarket({ marketId: m.id, closesAt: new Date(m.closesAt) });
    return ok(m);
  },
);
