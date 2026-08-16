import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { randomBytes } from "node:crypto";
import {
  readRefreshFromCookies,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from "@/lib/server/auth";
import {
  lookupRefreshToken,
  revokeRefreshToken,
  storeRefreshToken,
} from "@/lib/server/auth-store";
import { UsersRepo } from "@/lib/server/repos/users.repo";

export const runtime = "nodejs";

/**
 * Rotates the refresh token: revokes the presented one, issues a fresh pair.
 * Refresh reuse (same jti twice) is treated as a leak — `lookupRefreshToken`
 * already filters out revoked jtis, so a stolen+already-rotated token will
 * 401 here.
 */
export const POST = withRequestId(async (_req: NextRequest) => {
  const refresh = await readRefreshFromCookies();
  if (!refresh) return fail("Unauthorized", "Missing refresh token", 401);

  const record = await lookupRefreshToken(refresh.sub, refresh.jti);
  if (!record) return fail("Unauthorized", "Refresh expired or revoked", 401);

  // Revoke immediately so a leaked copy can't rotate twice.
  await revokeRefreshToken(refresh.sub, refresh.jti);

  const user = await UsersRepo.byId(refresh.sub);
  if (!user) return fail("Unauthorized", "User missing", 401);
  if (user.isBanned) return fail("Forbidden", "Account suspended", 403);

  const newJti = randomBytes(16).toString("hex");
  const newAccess = await signAccessToken(user);
  const newRefresh = await signRefreshToken(user, newJti);
  await storeRefreshToken({
    userId: user.id,
    jti: newJti,
    walletAddress: user.walletAddress,
    issuedAt: Date.now(),
  });
  await setAuthCookies(newAccess, newRefresh);

  return ok({ user });
});
