export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { BetsRepo } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const status = req.nextUrl.searchParams.get("status") as
    | "PENDING" | "WON" | "LOST" | "CANCELLED" | "CLAIMED" | "REFUNDED" | null;
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 30));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const { items, total } = await BetsRepo.listForUser(auth.sub, {
    ...(status ? { status } : {}),
    limit,
    offset,
  });
  return ok({ items, total, offset, limit });
});
