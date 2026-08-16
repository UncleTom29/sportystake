export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { BetsRepo } from "@/lib/server/repos/bets.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 30));
  const items = await BetsRepo.publicFeed(limit);
  return ok({ items });
});
