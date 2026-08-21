import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { ApiError } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import type { UserDTO, Address } from "@/lib/types";

const ACCESS_COOKIE = "ss_access";
const REFRESH_COOKIE = "ss_refresh";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

export interface AuthPayload {
  sub: string; // userId
  addr: string;
  roles: string[];
}

export interface RefreshPayload {
  sub: string;
  addr: string;
  jti: string;
  kind: "refresh";
}

export async function signAccessToken(user: UserDTO): Promise<string> {
  return signJwt({ sub: user.id, addr: user.walletAddress, roles: user.roles }, ACCESS_TTL);
}

export async function signRefreshToken(user: UserDTO, jti?: string): Promise<string> {
  return signJwt(
    { sub: user.id, addr: user.walletAddress, kind: "refresh", ...(jti ? { jti } : {}) },
    REFRESH_TTL,
  );
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const c = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  c.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 15, secure: isProd,
  });
  c.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: isProd,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const c = await cookies();
  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
}

export async function readAuthFromCookies(): Promise<AuthPayload | null> {
  try {
    const c = await cookies();
    const token = c.get(ACCESS_COOKIE)?.value;
    if (!token) return null;
    return await verifyJwt<AuthPayload>(token);
  } catch {
    return null;
  }
}

export async function readRefreshFromCookies(): Promise<RefreshPayload | null> {
  try {
    const c = await cookies();
    const token = c.get(REFRESH_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyJwt<RefreshPayload>(token);
    return payload.kind === "refresh" ? payload : null;
  } catch {
    return null;
  }
}

export async function readAuthFromRequest(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (!token) return null;
    return await verifyJwt<AuthPayload>(token);
  } catch {
    return null;
  }
}

export const KNOWN_ADMIN_WALLETS = new Set([
  "0x518923383f1184bfeb990b640d75dabb224e7f5b".toLowerCase(),
  "0xaa789e29a8ed011b57d7c3fe8a878d217ebebc22".toLowerCase(),
  "0x99B5208466bb6b359f4f4f4e735e5d3fa9612F37".toLowerCase(),
]);

export function isKnownAdminAddress(address?: string | null): boolean {
  if (!address) return false;
  const lower = address.toLowerCase();
  if (KNOWN_ADMIN_WALLETS.has(lower)) return true;
  const envAdmins = (process.env.ADMIN_WALLETS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return envAdmins.includes(lower);
}

function toUserDto(user: {
  id: string;
  walletAddress: string;
  username: string | null;
  referralCode: string;
  isPublic: boolean;
  isBanned: boolean;
  roles: string[];
  createdAt: Date;
}): UserDTO {
  const rolesSet = new Set(user.roles);
  if (isKnownAdminAddress(user.walletAddress)) {
    rolesSet.add("ADMIN");
    rolesSet.add("OPERATOR");
  }
  return {
    id: user.id,
    walletAddress: user.walletAddress as Address,
    referralCode: user.referralCode,
    isPublic: user.isPublic,
    isBanned: user.isBanned,
    roles: Array.from(rolesSet) as UserDTO["roles"],
    createdAt: user.createdAt.toISOString(),
    username: user.username ?? undefined,
  };
}

export async function requireUser(req: NextRequest): Promise<UserDTO> {
  const auth = await readAuthFromRequest(req);
  if (!auth) throw new ApiError("Unauthorized", "Not signed in", 401);
  const user = await prisma.user.findUnique({ where: { id: auth.sub } });
  if (!user) throw new ApiError("Unauthorized", "User not found", 401);
  if (user.isBanned) throw new ApiError("Forbidden", "Account suspended", 403);
  return toUserDto(user);
}

export async function requireAdmin(req: NextRequest): Promise<UserDTO> {
  const user = await requireUser(req);
  if (!user.roles.includes("ADMIN") && !isKnownAdminAddress(user.walletAddress)) {
    throw new ApiError("Forbidden", "Admin only", 403);
  }
  return user;
}

export function requireInternalKey(req: NextRequest): void {
  const key = req.headers.get("x-internal-key") ?? req.headers.get("x-oracle-key");
  const expected = process.env.ORACLE_INTERNAL_API_KEY ?? "dev-internal-key";
  if (!key || key !== expected) {
    throw new ApiError("Forbidden", "Invalid internal key", 403);
  }
}

/**
 * @deprecated Use `rateLimit()` from `@/lib/server/rate-limit` (Redis-backed)
 *             for cross-replica fairness. This in-memory shim is kept only so
 *             existing routes that import `checkRateLimit` continue to build.
 *             Throws on first overage; not as accurate as the sliding window.
 */
const _localBuckets = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const entry = _localBuckets.get(key);
  if (!entry || entry.resetAt < now) {
    _localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= limit) {
    throw new ApiError("RateLimited", "Too many requests", 429);
  }
  entry.count++;
}
