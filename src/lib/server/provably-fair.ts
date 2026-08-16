/**
 * Provably-fair commit-reveal RNG.
 *
 * Flow:
 *   1. Server picks a serverSeed (32 random bytes) and publishes
 *      `serverSeedHash = sha256(serverSeed)` to the client BEFORE the bet.
 *   2. Client picks a clientSeed (any string they want) and includes it in
 *      the bet request.
 *   3. Server resolves the bet using
 *      `result = HMAC-SHA256(serverSeed, clientSeed || ":" || nonce)`
 *      where `nonce` is a monotonic per-(serverSeed, client) counter.
 *   4. After settlement, the server publishes `serverSeed`. The client can
 *      verify both the hash and the result independently.
 *
 * This module is pure crypto — it must never touch the database directly.
 * Callers (the `/api/casino/*` routes) are responsible for persisting
 * `seedServerHash`, `seedClient`, `nonce`, and (eventually) `seedServer`
 * to the `CasinoBet` row.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SEED_BYTES = 32;

/** Generate a new serverSeed (hex string, 64 chars). */
export function generateServerSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

/** SHA-256 hex digest of a serverSeed. Safe to publish before play. */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

/**
 * Compute the bet result bytes from the (serverSeed, clientSeed, nonce) tuple.
 * Returns a Buffer of 32 bytes; callers slice it into the integers they need.
 */
export function deriveResult(serverSeed: string, clientSeed: string, nonce: number): Buffer {
  const msg = `${clientSeed}:${nonce}`;
  return createHmac("sha256", serverSeed).update(msg, "utf8").digest();
}

/** Verify that a publicly-revealed serverSeed matches the previously committed hash. */
export function verifyReveal(serverSeed: string, committedHash: string): boolean {
  const a = Buffer.from(hashServerSeed(serverSeed), "hex");
  const b = Buffer.from(committedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Game-specific result derivations ────────────────────────────────────────

/**
 * Dice: deterministic uniform float in [0, 100) derived from the first 4
 * bytes of the HMAC. Matches the convention used by Stake / BC.Game so the
 * client can verify with a tiny snippet.
 */
export function diceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const u32 = hmac.readUInt32BE(0);
  // 2^32 = 4294967296
  return (u32 / 4_294_967_296) * 100;
}

/**
 * Crash: deterministic crash multiplier (1.00x .. ~1000x).
 *   - 1% house edge: 1 in 100 rounds insta-bust at 1.00x.
 *   - Otherwise: multiplier = 99 / (1 - U) where U is uniform in [0, 1).
 *   - Capped at 1000x.
 */
export function crashMultiplier(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const u32 = hmac.readUInt32BE(0);
  if (u32 % 100 === 0) return 1.0;
  const u = u32 / 4_294_967_296;
  const m = 99 / (1 - u);
  return Math.min(1000, Math.max(1.01, Math.floor(m * 100) / 100));
}

/** Slots: pull 5 reels × 3 rows from successive bytes of the HMAC. */
export function slotReels(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  symbolCount: number,
): number[][] {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const rows = 3;
  const cols = 5;
  const reels: number[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      // 2 bytes per cell — plenty of entropy for ≤256 symbols.
      const byte = hmac[i % hmac.length] ^ hmac[(i + 7) % hmac.length];
      row.push(byte % symbolCount);
      i++;
    }
    reels.push(row);
  }
  return reels;
}

/** Roulette: 0..36 inclusive (European single-zero wheel). */
export function rouletteNumber(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  return hmac.readUInt32BE(0) % 37;
}

/** Generic 0..n-1 picker. Avoids modulo bias for n that doesn't divide 2^32. */
export function uniformIndex(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  n: number,
  cursor = 0,
): number {
  if (n <= 0) throw new Error("uniformIndex: n must be > 0");
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  // Modulo-bias-safe via rejection sampling on 4-byte windows.
  const max = Math.floor(0x100000000 / n) * n;
  for (let off = cursor; off + 4 <= hmac.length; off += 4) {
    const v = hmac.readUInt32BE(off);
    if (v < max) return v % n;
  }
  // Pathologically unlikely fallthrough — derive a fresh HMAC to retry.
  return uniformIndex(serverSeed + ":retry", clientSeed, nonce, n, 0);
}
