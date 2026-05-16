import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { computeLeaderboard } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const period = (req.nextUrl.searchParams.get("period") ?? "weekly") as "weekly" | "monthly" | "alltime";
  return ok({ period, items: computeLeaderboard(period) });
});
