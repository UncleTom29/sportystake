import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

const Body = z.object({ marketId: z.string() });

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Sign in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);
  const s = store();
  const pos = s.lpPositions.find((p) => p.userId === auth.sub && p.marketId === parsed.data.marketId && p.status === "ACTIVE");
  if (!pos) return fail("NotFound", "No active position", 404);
  pos.status = "WITHDRAWAL_REQUESTED";
  return ok({ position: pos, timelockHours: 48 });
});
