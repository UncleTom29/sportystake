import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? "50"));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? "0"));
  const s = store();
  let bets = s.bets.filter((b) => b.userId === auth.sub);
  if (status) bets = bets.filter((b) => b.status === status);
  bets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok({ items: bets.slice(offset, offset + limit), total: bets.length, offset, limit });
});
