import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // packages/contracts/test/*.spec.ts are Hardhat/Mocha tests (run via
    // `hardhat test` inside that package, not vitest) — vitest's default
    // glob would otherwise pick them up too and fail outside a Hardhat
    // project. Scope to the main app; packages manage their own test setups.
    exclude: ["**/node_modules/**", "packages/**"],
    // src/lib/env.ts validates its server schema eagerly at import time —
    // unlike Next.js, vitest doesn't load .env on its own, and unit tests
    // shouldn't depend on a real local .env existing anyway. Dummy values
    // for just the two fields with no schema default, enough to satisfy
    // validation without touching a real database or secret.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-jwt-secret-at-least-32-characters-long",
      PRIVY_APP_SECRET: "test-privy-app-secret-at-least-32-characters-long",
      NEXT_PUBLIC_PRIVY_APP_ID: "test-privy-app-id",
    },
  },
});
