import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

const UsernameBody = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) throw new ApiError("Unauthorized", "Sign in required", 401);

  const parsed = UsernameBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", parsed.error.issues[0]?.message || "Invalid username", 400, {
      details: parsed.error.issues,
    });
  }

  const { username } = parsed.data;

  // Check if username is already taken (case-insensitive)
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      id: { not: auth.sub },
    },
  });

  if (existing) {
    throw new ApiError("Conflict", "Username is already taken", 409);
  }

  const updated = await prisma.user.update({
    where: { id: auth.sub },
    data: { username },
  });

  return ok({
    user: {
      id: updated.id,
      walletAddress: updated.walletAddress as `0x${string}`,
      username: updated.username,
      roles: updated.roles,
    },
  });
});
