import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * Last 50 distinct crash rounds (anyone). Pulls from CasinoBet (game=CRASH)
 * and dedupes by the `nonce` field (we use round id as the per-game nonce).
 */
export const GET = withRequestId(async (_req: NextRequest) => {
  const rows = await prisma.casinoBet.findMany({
    where: { game: "CRASH" },
    orderBy: { resolvedAt: "desc" },
    take: 500, // grab a wider slice, dedupe in JS
    select: { nonce: true, resolvedAt: true, metadata: true },
  });
  const seen = new Set<number>();
  const items: { id: number; crashMultiplierX100: number; at: string }[] = [];
  for (const r of rows) {
    if (seen.has(r.nonce)) continue;
    seen.add(r.nonce);
    const md = (r.metadata as { crashAtX100?: number } | null) ?? null;
    items.push({
      id: r.nonce,
      crashMultiplierX100: md?.crashAtX100 ?? 0,
      at: r.resolvedAt?.toISOString() ?? new Date().toISOString(),
    });
    if (items.length >= 50) break;
  }
  return ok({ items });
});
