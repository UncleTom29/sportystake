import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { clearAuthCookies, readRefreshFromCookies } from "@/lib/server/auth";
import { revokeRefreshToken } from "@/lib/server/auth-store";

export const runtime = "nodejs";

/**
 * Logout: revoke the refresh token in Redis + clear cookies.
 * Both DELETE and POST are accepted to match how the existing client
 * (`Auth.logout()`) calls this endpoint.
 */
export const DELETE = withRequestId(async (_req: NextRequest) => {
  const refresh = await readRefreshFromCookies();
  if (refresh?.jti) {
    await revokeRefreshToken(refresh.sub, refresh.jti);
  }
  await clearAuthCookies();
  return ok({ loggedOut: true });
});

export const POST = DELETE;
