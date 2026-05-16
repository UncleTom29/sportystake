import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { generatePrediction } from "@/lib/server/analytics";

export const runtime = "nodejs";

const Body = z.object({ marketId: z.string() });

export const POST = withRequestId(async (req: NextRequest) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "marketId required", 400);
  try {
    const result = await generatePrediction(parsed.data.marketId);
    return ok(result);
  } catch (err) {
    return fail("PredictionFailed", (err as Error).message ?? "Failed to generate prediction", 500);
  }
});
