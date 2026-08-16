import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { LinkedAccount } from "@privy-io/node";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { rateLimit } from "@/lib/server/rate-limit";
import { storeRefreshToken } from "@/lib/server/auth-store";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/server/auth";
import { getPrivyClient } from "@/lib/server/privy";
import { prisma } from "@/lib/server/db";
import { referralCode } from "@/lib/uid";
import type { Address } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ identityToken: z.string().min(1) });
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() ?? "anon";
}

function walletAddressFrom(linkedAccounts: LinkedAccount[]): string | undefined {
  const wallets = linkedAccounts.filter(
    (a): a is LinkedAccount & { address: string } =>
      a.type === "wallet" && typeof (a as { address?: unknown }).address === "string",
  );
  const embedded = wallets.find((a) => (a as { wallet_client_type?: unknown }).wallet_client_type === "privy");
  return (embedded ?? wallets[0])?.address;
}

export const POST = withRequestId(async (req: NextRequest) => {
  const ip = clientIp(req);
  const rl = await rateLimit(`privy-session:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return fail("RateLimited", "Too many sign-in attempts", 429, {
      details: { retryAfterMs: rl.retryAfterMs },
    });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
  }
  const { identityToken } = parsed.data;

  const privy = getPrivyClient();
  const privyUser = await privy
    .utils()
    .auth()
    .verifyIdentityToken(identityToken)
    .catch((err: unknown) => {
      console.error("privy-session: verifyIdentityToken failed:", err);
      return null;
    });

  if (!privyUser) {
    throw new ApiError("Unauthorized", "Invalid or expired Privy identity token", 401);
  }

  let rawAddress = walletAddressFrom(privyUser.linked_accounts);

  if (!rawAddress) {
    try {
      const fullUser = await privy.users()._get(privyUser.id);
      if (fullUser?.linked_accounts) {
        rawAddress = walletAddressFrom(fullUser.linked_accounts);
      }
    } catch (err) {
      console.warn("privy-session: failed fetching full user:", err);
    }
  }

  if (!rawAddress) {
    try {
      const userWithWallet = await privy.users().pregenerateWallets(privyUser.id, {
        wallets: [{ chain_type: "ethereum" }],
      });
      if (userWithWallet?.linked_accounts) {
        rawAddress = walletAddressFrom(userWithWallet.linked_accounts);
      }
    } catch (err) {
      console.warn("privy-session: failed pregenerating wallet:", err);
    }
  }

  if (!rawAddress || !EVM_ADDRESS_RE.test(rawAddress)) {
    throw new ApiError("NotFound", "No EVM wallet found for this Privy user — retrying wallet creation", 404);
  }

  const address = rawAddress.toLowerCase() as Address;

  let user = await prisma.user.findFirst({
    where: { OR: [{ privyId: privyUser.id }, { walletAddress: address }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        privyId: privyUser.id,
        walletAddress: address,
        referralCode: referralCode(),
        isPublic: true,
        isBanned: false,
        roles: ["USER"],
        lastSeenAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        privyId: privyUser.id,
        walletAddress: address,
        lastSeenAt: new Date(),
      },
    });
  }

  if (user.isBanned) {
    throw new ApiError("Forbidden", "Account suspended", 403);
  }

  const userDto = {
    id: user.id,
    walletAddress: user.walletAddress as Address,
    referralCode: user.referralCode,
    isPublic: user.isPublic,
    isBanned: user.isBanned,
    roles: user.roles,
    createdAt: user.createdAt.toISOString(),
    username: user.username ?? undefined,
  };

  const jti = randomBytes(16).toString("hex");
  const accessToken = await signAccessToken(userDto);
  const refreshToken = await signRefreshToken(userDto, jti);

  await storeRefreshToken({
    userId: user.id,
    jti,
    walletAddress: user.walletAddress,
    issuedAt: Date.now(),
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  await setAuthCookies(accessToken, refreshToken);

  return ok({ user: userDto, tokens: { accessToken } });
});
