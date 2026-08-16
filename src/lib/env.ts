/**
 * Centralized env-var validation for the Next.js app. Imported at module-load
 * time from `instrumentation.ts`, which means the server refuses to boot if
 * any required secret is missing or malformed.
 *
 * NEVER read `process.env` directly outside this file. Always import `env`
 * here so the type-safety + validation guarantees apply everywhere.
 */

import { z } from "zod";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-char hex address");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Database / cache
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 chars — generate with `openssl rand -hex 32`"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

  // Oracle
  ORACLE_INTERNAL_API_URL: z.string().url().default("http://localhost:3002"),
  ORACLE_INTERNAL_API_KEY: z.string().min(1).default("change-me"),

  // Security
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_BURST: z.coerce.number().int().positive().default(20),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),

  // Operator keys — per-contract separation (Fix #3). Each contract can
  // have its own key so a single leak doesn't compromise the whole bankroll.
  // Falls back to the shared OPERATOR_PRIVATE_KEY in operatorWallet.ts.
  OPERATOR_PRIVATE_KEY_CASINO: z.string().optional(),
  OPERATOR_PRIVATE_KEY_CRASH: z.string().optional(),
  OPERATOR_PRIVATE_KEY_BETTING: z.string().optional(),

  // Privy (auth + embedded wallets). Required — `privy.ts` mints the
  // server-side client from these on every verify/session call.
  PRIVY_APP_SECRET: z
    .string()
    .min(1, "PRIVY_APP_SECRET is required — get it from dashboard.privy.io"),

  // Signs MarketAttestation tickets (see BettingCore.sol's ORACLE_SIGNER_ROLE)
  // that let a bettor's own wallet permissionlessly register a market
  // on-chain as part of placeBetWithAttestation/placeParlayBetWithAttestations.
  // Optional — absent until scripts/initialize-v2.ts has granted this key's
  // address ORACLE_SIGNER_ROLE on the live contract; routes fall back to
  // omitting the attestation (client then can't bet on a not-yet-created
  // market) when unset.
  ORACLE_ATTESTATION_PRIVATE_KEY: z.string().optional(),
});

const DEPLOYED_ARC_TESTNET = {
  usdc: "0x3600000000000000000000000000000000000000",
  liquidityPool: "0x574DF566b98E6f3Cb7459b39BFD9afeD8694A154",
  bettingCore: "0x091E1Fe9576E4E090FE95eD8bB25a19B01FAbcf0",
  casinoHouse: "0x615f95fa5ccCe9Cd79d7aBc0e37983aaDD9f9b9d",
  crashGame: "0xa7FF5FB348FeEfEf4C092CD67AE62344A33Be8A0",
};

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().positive().default(5042002),
  NEXT_PUBLIC_RPC_URL: z.string().url().default("https://arc-testnet.drpc.org"),
  NEXT_PUBLIC_BETTING_CORE_ADDRESS: addressSchema.default(DEPLOYED_ARC_TESTNET.bettingCore),
  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS: addressSchema.default(DEPLOYED_ARC_TESTNET.liquidityPool),
  NEXT_PUBLIC_CASINO_HOUSE_ADDRESS: addressSchema.default(DEPLOYED_ARC_TESTNET.casinoHouse),
  NEXT_PUBLIC_CRASH_GAME_ADDRESS: addressSchema.default(DEPLOYED_ARC_TESTNET.crashGame),
  NEXT_PUBLIC_USDC_ADDRESS: addressSchema.default(DEPLOYED_ARC_TESTNET.usdc),
  NEXT_PUBLIC_PRIVY_APP_ID: z
    .string()
    .min(1, "NEXT_PUBLIC_PRIVY_APP_ID is required — get it from dashboard.privy.io"),
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
});

function validAddress(val?: string, fallback?: string): string {
  if (!val || val === "0x0000000000000000000000000000000000000000") return fallback!;
  return val;
}

// Pull NEXT_PUBLIC_* into a plain object so the schema parse works in
// edge/browser contexts where `process.env` is not directly enumerable.
const clientRaw = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_BETTING_CORE_ADDRESS: validAddress(process.env.NEXT_PUBLIC_BETTING_CORE_ADDRESS, DEPLOYED_ARC_TESTNET.bettingCore),
  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS: validAddress(process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS, DEPLOYED_ARC_TESTNET.liquidityPool),
  NEXT_PUBLIC_CASINO_HOUSE_ADDRESS: validAddress(process.env.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS, DEPLOYED_ARC_TESTNET.casinoHouse),
  NEXT_PUBLIC_CRASH_GAME_ADDRESS: validAddress(process.env.NEXT_PUBLIC_CRASH_GAME_ADDRESS, DEPLOYED_ARC_TESTNET.crashGame),
  NEXT_PUBLIC_USDC_ADDRESS: validAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS, DEPLOYED_ARC_TESTNET.usdc),
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
};

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function loadServer(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server env configuration:\n${issues}`);
  }
  return parsed.data;
}

function loadClient(): ClientEnv {
  const parsed = clientSchema.safeParse(clientRaw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid client env configuration:\n${issues}`);
  }
  return parsed.data;
}

// Server-only env. Throws on import if invalid — do NOT import from a client
// component (it'll leak server secrets into the bundle).
export const serverEnv: ServerEnv =
  typeof window === "undefined" ? loadServer() : ({} as ServerEnv);

// Safe to import anywhere — only contains NEXT_PUBLIC_* values.
export const clientEnv: ClientEnv = loadClient();

export type { ServerEnv, ClientEnv };
