import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireInternalKey } from "@/lib/server/auth";
import { publish } from "@/lib/server/event-bus";
import { redisPublisher } from "@/lib/server/redis";

export const runtime = "nodejs";

const Body = z.object({
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetAt: z.string(),
  mode: z.enum(["normal", "conservation", "emergency"]),
});

/**
 * Quota snapshot push. The oracle owns authoritative quota state — this
 * endpoint just rebroadcasts so subscribers (SSE + the quota:alert Redis
 * channel) see the same payload. Useful when running multiple Next.js
 * replicas that need the in-process event bus to fire.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  requireInternalKey(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400);
  publish("quota:alert", parsed.data);
  await redisPublisher().publish("quota:alert", JSON.stringify({
    type: "quota:snapshot",
    ...parsed.data,
    ts: new Date().toISOString(),
  }));
  return ok({ updated: true });
});
