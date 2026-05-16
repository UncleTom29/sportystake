import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";

export const runtime = "nodejs";

const Body = z.object({
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetAt: z.string(),
  mode: z.enum(["normal", "conservation", "emergency"]),
});

export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);
  store().quota = parsed.data;
  publish("quota:alert", parsed.data);
  return ok({ updated: true });
});
