export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { fail, ok, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

type FavoriteBody =
  | { type: "market"; marketId: string }
  | { type: "league"; leagueId: number };

function toKey(input: FavoriteBody): string {
  return input.type === "market" ? `market:${input.marketId}` : `league:${input.leagueId}`;
}

function parseBody(raw: unknown): FavoriteBody | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.type === "market" && typeof body.marketId === "string" && body.marketId.length > 0) {
    return { type: "market", marketId: body.marketId };
  }
  if (body.type === "league" && typeof body.leagueId === "number" && Number.isFinite(body.leagueId)) {
    return { type: "league", leagueId: body.leagueId };
  }
  return null;
}

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return ok({ marketIds: [], leagueIds: [], total: 0, requiresAuth: true });

  const rows = await prisma.favorite.findMany({
    where: { userId: auth.sub },
    select: { kind: true, marketId: true, leagueId: true },
    orderBy: { createdAt: "desc" },
  });

  const marketIds = rows.filter((r) => r.kind === "MARKET" && r.marketId).map((r) => r.marketId as string);
  const leagueIds = rows.filter((r) => r.kind === "LEAGUE" && r.leagueId !== null).map((r) => r.leagueId as number);

  return ok({ marketIds, leagueIds, total: marketIds.length + leagueIds.length, requiresAuth: false });
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to save favourites", 401);

  const parsed = parseBody(await req.json().catch(() => null));
  if (!parsed) return fail("ValidationError", "Invalid favourite payload", 400);

  if (parsed.type === "market") {
    const exists = await prisma.market.findUnique({ where: { id: parsed.marketId }, select: { id: true } });
    if (!exists) return fail("NotFound", "Market not found", 404);
  }

  const key = toKey(parsed);
  const row = await prisma.favorite.upsert({
    where: { userId_key: { userId: auth.sub, key } },
    update: {},
    create: {
      userId: auth.sub,
      key,
      kind: parsed.type === "market" ? "MARKET" : "LEAGUE",
      ...(parsed.type === "market" ? { marketId: parsed.marketId } : { leagueId: parsed.leagueId }),
    },
    select: { kind: true, marketId: true, leagueId: true },
  });

  return ok({
    saved: true,
    favorite: {
      kind: row.kind,
      marketId: row.marketId ?? undefined,
      leagueId: row.leagueId ?? undefined,
    },
  });
});

export const DELETE = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in to manage favourites", 401);

  const parsed = parseBody(await req.json().catch(() => null));
  if (!parsed) return fail("ValidationError", "Invalid favourite payload", 400);

  await prisma.favorite.deleteMany({
    where: {
      userId: auth.sub,
      key: toKey(parsed),
    },
  });

  return ok({ removed: true });
});
