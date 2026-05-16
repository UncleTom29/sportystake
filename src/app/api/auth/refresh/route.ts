import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { verifyJwt } from "@/lib/jwt";
import { store } from "@/lib/server/store";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

export const POST = withRequestId(async (_req: NextRequest) => {
  const c = await cookies();
  const refresh = c.get("ss_refresh")?.value;
  if (!refresh) return fail("Unauthorized", "Missing refresh token", 401);

  let payload: { sub: string; kind?: string };
  try {
    payload = await verifyJwt(refresh);
  } catch {
    return fail("Unauthorized", "Invalid refresh token", 401);
  }
  if (payload.kind !== "refresh") return fail("Unauthorized", "Wrong token type", 401);

  const s = store();
  const stored = s.refreshTokens.get(refresh);
  if (!stored || stored.expiresAt < Date.now()) return fail("Unauthorized", "Refresh expired", 401);
  s.refreshTokens.delete(refresh);

  const user = s.users.find((u) => u.id === payload.sub);
  if (!user) return fail("Unauthorized", "User missing", 401);

  const newAccess = await signAccessToken(user);
  const newRefresh = await signRefreshToken(user);
  s.refreshTokens.set(newRefresh, { token: newRefresh, userId: user.id, expiresAt: Date.now() + 7 * 86400_000 });
  await setAuthCookies(newAccess, newRefresh);
  return ok({ user });
});
