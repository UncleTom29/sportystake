/**
 * Redis-backed storage for refresh tokens and revoked tokens. Multi-pod
 * deployments share session state this way, and process restarts don't sign
 * users out.
 *
 * Key layout:
 *   ss:refresh:<userId>:<jti> → JSON         (TTL: 30 days)
 *   ss:refresh:revoked:<jti>  → "1"          (TTL: 30 days)
 */
import { redis } from "./redis";
import { serverEnv } from "@/lib/env";

const REFRESH_KEY = (uid: string, jti: string) => `ss:refresh:${uid}:${jti}`;
const REFRESH_REVOKED_KEY = (jti: string) => `ss:refresh:revoked:${jti}`;

const REFRESH_TTL_SEC = serverEnv.JWT_REFRESH_TTL_SECONDS;

// ─── Refresh tokens ─────────────────────────────────────────────────────────

export interface RefreshRecord {
  userId: string;
  jti: string;
  walletAddress: string;
  issuedAt: number;
  ip?: string;
  userAgent?: string;
}

export async function storeRefreshToken(record: RefreshRecord): Promise<void> {
  await redis().set(
    REFRESH_KEY(record.userId, record.jti),
    JSON.stringify(record),
    "EX",
    REFRESH_TTL_SEC,
  );
}

export async function lookupRefreshToken(userId: string, jti: string): Promise<RefreshRecord | null> {
  const r = redis();
  // Reject revoked tokens first to keep the happy path cheap.
  const revoked = await r.get(REFRESH_REVOKED_KEY(jti));
  if (revoked) return null;
  const raw = await r.get(REFRESH_KEY(userId, jti));
  if (!raw) return null;
  return JSON.parse(raw) as RefreshRecord;
}

export async function revokeRefreshToken(userId: string, jti: string): Promise<void> {
  const r = redis();
  await r.del(REFRESH_KEY(userId, jti));
  await r.set(REFRESH_REVOKED_KEY(jti), "1", "EX", REFRESH_TTL_SEC);
}

/** Revoke every refresh token for a user (e.g. on logout-all-devices). */
export async function revokeAllRefreshTokens(userId: string): Promise<number> {
  const r = redis();
  const pattern = REFRESH_KEY(userId, "*");
  let cursor = "0";
  let count = 0;
  do {
    const [next, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    if (keys.length > 0) {
      // Extract jti from each key for the revoked-list set.
      for (const key of keys) {
        const jti = key.split(":").pop()!;
        await r.set(REFRESH_REVOKED_KEY(jti), "1", "EX", REFRESH_TTL_SEC);
      }
      await r.del(...keys);
      count += keys.length;
    }
  } while (cursor !== "0");
  return count;
}
