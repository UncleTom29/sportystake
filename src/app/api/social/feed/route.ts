import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? "30"));
  return ok({ items: store().feed.slice(0, limit) });
});
