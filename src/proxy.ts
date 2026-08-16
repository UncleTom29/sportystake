/**
 * Edge proxy: CORS + per-IP rate limiting.
 *
 * (Renamed from `middleware.ts` — Next.js deprecated the `middleware`
 * file convention in favor of `proxy`. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md)
 *
 * Rate-limit strategy:
 *   - Token-bucket math kept inside proxy (edge-friendly, zero latency).
 *   - The bucket itself lives in a per-runtime-instance Map. Sufficient for
 *     single-replica deployments and dev.
 *   - For multi-replica production deployments, the per-route handlers under
 *     /api/* should additionally call `rateLimit()` from
 *     [src/lib/server/rate-limit.ts](src/lib/server/rate-limit.ts) which is
 *     backed by Redis and shared across replicas. The proxy bucket is
 *     a fast pre-filter; Redis is the source of truth.
 *
 * Excluded paths:
 *   - /api/internal/*  — guarded by ORACLE_INTERNAL_API_KEY, not IP
 *   - /api/health*     — must always respond for k8s probes
 *   - /api/socket      — SSE stream can't be rate-limited mid-stream
 *
 * Client IP trust: `cf-connecting-ip` is only trustworthy once the origin
 * is firewalled to accept traffic exclusively from Cloudflare's published
 * IP ranges (https://www.cloudflare.com/ips/) at both the EC2 security
 * group and the OS firewall (ufw) — otherwise it's spoofable like any
 * other header. Falls back to x-forwarded-for/x-real-ip for local dev and
 * non-Cloudflare paths.
 */
import { NextResponse, type NextRequest } from "next/server";

const RPM = Number(process.env.RATE_LIMIT_RPM ?? 300);
const BURST = Number(process.env.RATE_LIMIT_BURST ?? 60);

type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function routeGroup(pathname: string): string {
  if (pathname.startsWith("/api/auth")) return "auth";
  if (pathname.startsWith("/api/admin")) return "admin";
  if (pathname.startsWith("/api/bets")) return "bets";
  if (pathname.startsWith("/api/liquidity")) return "liquidity";
  if (pathname.startsWith("/api/casino")) return "casino";
  if (pathname.startsWith("/api/markets")) return "markets";
  if (pathname.startsWith("/api/favourites")) return "favourites";
  return "default";
}

function consume(key: string, capacity: number, refillPerSec: number): boolean {
  if (buckets.size > MAX_BUCKETS) {
    // Crude LRU: drop the first 10% on overflow. Prevents unbounded memory.
    const drop = Math.floor(MAX_BUCKETS / 10);
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= drop) break;
    }
  }
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(key, bucket);
  }
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oracle-key");
  }
  return res;
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (req.method === "OPTIONS") {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }

  if (
    !pathname.startsWith("/api/") ||
    pathname.startsWith("/api/internal/") ||
    pathname === "/api/health" ||
    pathname === "/api/health/detailed" ||
    pathname === "/api/socket"
  ) {
    return applyCors(req, NextResponse.next());
  }

  const ip = clientIp(req);
  const group = routeGroup(pathname);
  const key = `${ip}:${group}`;
  const refillPerSec = RPM / 60;

  if (!consume(key, BURST, refillPerSec)) {
    const res = NextResponse.json(
      { error: "rate_limited", retryAfterSec: 1 },
      { status: 429 },
    );
    res.headers.set("Retry-After", "1");
    res.headers.set("X-RateLimit-Limit", String(RPM));
    res.headers.set("X-RateLimit-Burst", String(BURST));
    return applyCors(req, res);
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(RPM));
  res.headers.set("X-RateLimit-Burst", String(BURST));
  return applyCors(req, res);
}

export const config = {
  matcher: ["/api/:path*"],
};
