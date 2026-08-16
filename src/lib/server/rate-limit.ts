/**
 * Redis sliding-window rate limiter. Replaces the in-memory token-bucket
 * fallback so multi-pod deployments enforce a single shared budget.
 *
 * Algorithm: a sorted set keyed by `bucket`. Each request `ZADD`s a member
 * keyed by the request timestamp (microseconds + nanoid suffix to avoid
 * collisions); old members past `windowMs` are removed with `ZREMRANGEBYSCORE`.
 * The cardinality after the eviction is the current count.
 *
 * One round-trip per check via a Lua script (avoids race between count + add).
 */
import { randomBytes } from "node:crypto";
import { redis } from "./redis";

const SCRIPT = `
local key   = KEYS[1]
local now   = tonumber(ARGV[1])
local win   = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local mem   = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - win)
local count = redis.call("ZCARD", key)
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retry = 1000
  if oldest[2] then
    retry = math.max(1, win - (now - tonumber(oldest[2])))
  end
  return {0, count, retry}
end
redis.call("ZADD", key, now, mem)
redis.call("PEXPIRE", key, win)
return {1, count + 1, 0}
`;

let scriptSha: string | null = null;

async function loadScript(): Promise<string> {
  if (scriptSha) return scriptSha;
  const r = redis();
  scriptSha = await r.script("LOAD", SCRIPT) as string;
  return scriptSha;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterMs: number;
}

/**
 * Attempts a request against the sliding window. Returns `allowed=false`
 * when the bucket is full. `retryAfterMs` is the wait until the oldest
 * member expires.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const r = redis();
  const now = Date.now();
  const member = `${now}-${randomBytes(4).toString("hex")}`;
  try {
    const sha = await loadScript();
    const res = await r.evalsha(
      sha, 1, bucket,
      String(now), String(windowMs), String(limit), member,
    ) as [number, number, number];
    return { allowed: res[0] === 1, count: res[1], retryAfterMs: res[2] };
  } catch (err) {
    // Script may have been flushed; reload and try once more.
    const message = (err as Error).message ?? "";
    if (message.includes("NOSCRIPT")) {
      scriptSha = null;
      return rateLimit(bucket, limit, windowMs);
    }
    // Fail open: if Redis is down we'd rather serve traffic than 500 every
    // request. Log + allow. The /api/health/detailed endpoint will surface it.
    // eslint-disable-next-line no-console
    console.warn("[rate-limit] redis error, failing open", message);
    return { allowed: true, count: 0, retryAfterMs: 0 };
  }
}
