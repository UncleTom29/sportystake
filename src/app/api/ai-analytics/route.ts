import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { getDailyAIAnalysis } from "@/lib/server/aiEngine";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const force = req.nextUrl.searchParams.get("refresh") === "true";
  const analysis = await getDailyAIAnalysis(force);
  return ok(analysis);
});
