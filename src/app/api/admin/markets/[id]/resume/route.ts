import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
      throw new ApiError("Forbidden", "Admin or Operator access required", 403);
    }

    const { id } = await ctx.params;
    const market = await prisma.market.findUnique({ where: { id } });
    if (!market) throw new ApiError("NotFound", "Market not found", 404);
    if (market.status !== "SUSPENDED") {
      throw new ApiError("Conflict", "Market is not suspended", 409);
    }

    const updated = await prisma.market.update({
      where: { id },
      data: { status: "OPEN" },
    });

    return ok({
      market: {
        ...updated,
        startTime: updated.startTime.toISOString(),
        closesAt: updated.closesAt.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        fixtureId: Number(updated.fixtureId),
        homeTeamId: Number(updated.homeTeamId),
        awayTeamId: Number(updated.awayTeamId),
      },
    });
  },
);
