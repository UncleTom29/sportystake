import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return ok({ available: false, reason: "Username is required" });
  }

  if (username.length < 3 || username.length > 20) {
    return ok({ available: false, reason: "Username must be between 3 and 20 characters" });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return ok({ available: false, reason: "Username can only contain letters, numbers, and underscores" });
  }

  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      ...(auth ? { id: { not: auth.sub } } : {}),
    },
  });

  if (existing) {
    return ok({ available: false, reason: "Username is already taken" });
  }

  return ok({ available: true });
});
