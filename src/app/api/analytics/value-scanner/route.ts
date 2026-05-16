import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { valueScanner } from "@/lib/server/analytics";

export const runtime = "nodejs";

export const GET = withRequestId(async (_req: NextRequest) => {
  const items = await valueScanner();
  return ok({ items });
});
