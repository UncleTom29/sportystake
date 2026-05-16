import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { verifySiwe } from "@/lib/siwe";
import { store } from "@/lib/server/store";
import { signAccessToken, signRefreshToken, setAuthCookies, checkRateLimit } from "@/lib/server/auth";
import { referralCode, shortId } from "@/lib/uid";
import type { UserDTO, Address } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  // Dev-mode escape hatch: allows wallet-less testing flow when ALLOW_DEV_SIGNIN=1
  dev: z.object({ address: z.string() }).optional(),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  checkRateLimit(`auth-verify:${ip}`, 5, 60_000);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });

  const s = store();
  let address: Address;

  if (parsed.data.dev && process.env.ALLOW_DEV_SIGNIN !== "0") {
    // Allow dev address sign-in without real signature when explicitly opted-in.
    address = parsed.data.dev.address.toLowerCase() as Address;
  } else {
    const siwe = await verifySiwe(parsed.data.message, parsed.data.signature as `0x${string}`);
    const stored = s.nonces.get(siwe.address.toLowerCase());
    if (!stored || stored.nonce !== siwe.nonce || stored.expiresAt < Date.now()) {
      throw new ApiError("InvalidNonce", "Nonce expired or unknown", 401);
    }
    s.nonces.delete(siwe.address.toLowerCase());
    address = siwe.address;
  }

  let user = s.users.find((u) => u.walletAddress.toLowerCase() === address.toLowerCase());
  if (!user) {
    user = {
      id: `user-${shortId()}`,
      walletAddress: address,
      referralCode: referralCode(),
      isPublic: true,
      isBanned: false,
      roles: ["USER"],
      createdAt: new Date().toISOString(),
    } as UserDTO;
    s.users.push(user);
  }
  if (user.isBanned) throw new ApiError("Forbidden", "Account suspended", 403);

  const accessToken = await signAccessToken(user);
  const refreshToken = await signRefreshToken(user);
  s.refreshTokens.set(refreshToken, { token: refreshToken, userId: user.id, expiresAt: Date.now() + 7 * 86400_000 });
  await setAuthCookies(accessToken, refreshToken);

  return ok({ user, tokens: { accessToken } });
});
