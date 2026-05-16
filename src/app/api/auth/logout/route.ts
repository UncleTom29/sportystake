import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { clearAuthCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

export const DELETE = withRequestId(async (_req: NextRequest) => {
  await clearAuthCookies();
  return ok({ loggedOut: true });
});

export const POST = DELETE;
