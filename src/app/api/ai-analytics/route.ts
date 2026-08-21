import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { getDailyAIAnalysis } from "@/lib/server/aiEngine";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const force = req.nextUrl.searchParams.get("refresh") === "true";
  if (force) {
    await requireAdmin(req);
  }
  const analysis = await getDailyAIAnalysis(force);
  return ok(analysis);
});

export const POST = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const analysis = await getDailyAIAnalysis(true);
  return ok(analysis);
});
