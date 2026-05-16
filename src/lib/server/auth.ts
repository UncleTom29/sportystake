import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { ApiError } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import type { UserDTO } from "@/lib/types";

const ACCESS_COOKIE = "ss_access";
const REFRESH_COOKIE = "ss_refresh";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export interface AuthPayload {
  sub: string; // userId
  addr: string;
  roles: string[];
}

export async function signAccessToken(user: UserDTO): Promise<string> {
  return signJwt({ sub: user.id, addr: user.walletAddress, roles: user.roles }, ACCESS_TTL);
}

export async function signRefreshToken(user: UserDTO): Promise<string> {
  return signJwt({ sub: user.id, addr: user.walletAddress, kind: "refresh" }, REFRESH_TTL);
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const c = await cookies();
  c.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 15, secure: process.env.NODE_ENV === "production",
  });
  c.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === "production",
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

export async function readAuthFromRequest(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (!token) return null;
    return await verifyJwt<AuthPayload>(token);
  } catch {
    return null;
  }
}

export async function requireUser(req: NextRequest): Promise<UserDTO> {
  const auth = await readAuthFromRequest(req);
  if (!auth) throw new ApiError("Unauthorized", "Not signed in", 401);
  const s = store();
  const user = s.users.find((u) => u.id === auth.sub);
  if (!user) throw new ApiError("Unauthorized", "User not found", 401);
  if (user.isBanned) throw new ApiError("Forbidden", "Account suspended", 403);
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<UserDTO> {
  const user = await requireUser(req);
  if (!user.roles.includes("ADMIN")) throw new ApiError("Forbidden", "Admin only", 403);
  return user;
}

export function requireInternalKey(req: NextRequest): void {
  const key = req.headers.get("x-internal-key");
  const expected = process.env.ORACLE_INTERNAL_API_KEY ?? "dev-internal-key";
  if (!key || key !== expected) {
    throw new ApiError("Forbidden", "Invalid internal key", 403);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const s = store();
  const now = Date.now();
  const entry = s.rateLimits.get(key);
  if (!entry || entry.resetAt < now) {
    s.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= limit) {
    throw new ApiError("RateLimited", "Too many requests", 429);
  }
  entry.count++;
}
