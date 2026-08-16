import { NextRequest } from "next/server";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
    throw new ApiError("Forbidden", "Admin or Operator access required", 403);
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, walletAddress: true, username: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  return ok({
    items: items.map((l) => ({
      id: l.id,
      action: l.action,
      target: l.target,
      ip: l.ip,
      userAgent: l.userAgent,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      actor: l.actor ? { ...l.actor, walletAddress: l.actor.walletAddress as `0x${string}` } : null,
    })),
    total,
    limit,
    offset,
  });
});
