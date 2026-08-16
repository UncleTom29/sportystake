# SportyStake — Production Hardening Backlog

This file is the source of truth for what still has to happen before
SportyStake can take real money. Every item here was either started in the
"local-real stack" session or explicitly deferred. Items are ordered by
*blast radius if shipped without it* — the top of the list will lose user
funds; the bottom will lose user trust.

---

## 🔴 P0 — must land before any mainnet usage

### Replace the in-memory store with Prisma queries
- **Where:** [src/lib/server/store.ts](src/lib/server/store.ts) is a
  ~700-line `globalThis` singleton powering all 60+ API routes. The Prisma
  schema is now in [prisma/schema.prisma](prisma/schema.prisma) but no
  consumer reads from it yet.
- **What to do:**
  1. `npm run db:migrate` to create tables.
  2. Replace `store().bets.push(...)` with `prisma.bet.create(...)` etc.
     Start with `/api/bets/*`, then `/api/liquidity/*`, then `/api/auth/*`.
  3. Delete the seed data and the four `setInterval` simulators in
     `store.ts` — the oracle is now the source of fixture/odds truth.
  4. Move SIWE nonces + refresh tokens to Redis (they're in `store.ts` too).
- **Risk if skipped:** Every process restart wipes user balances, open bets,
  and LP positions. Multi-replica deployments will diverge silently.

### Wire on-chain bet settlement instead of `Math.random()` resolution
- **Where:** [src/lib/server/store.ts:510](src/lib/server/store.ts#L510)
  `settleMarketBets` literally rolls a die for non-1X2 markets.
- **What to do:**
  1. Add a settlement worker that listens for oracle `market:finished`
     events on Redis.
  2. Aggregates the winning bet ids from Postgres (per outcome) and calls
     `BettingCore.settleMarket(...)` via the SDK with the operator key.
  3. Marks bets as `WON`/`LOST` in Postgres from the on-chain
     `MarketSettled` event, NOT optimistically.
- **Risk if skipped:** Users see fake outcomes; LPs lose/win randomly.

### CrashGame solvency + DoS fixes
- **Where:** [packages/contracts/contracts/CrashGame.sol](packages/contracts/contracts/CrashGame.sol)
- **Bugs:**
  - No backing liquidity. If everyone wins at 10x, the contract can't pay.
  - `resolveRound` is an unbounded loop — operator may not be able to
    settle a round with hundreds of players in a single block.
  - `joinRound` has no `amount` bounds.
- **Fix:** Add LP backing (an `MarketLiquidityPool` for the casino house),
  cap players per round (e.g. 100), and add `MIN_STAKE` / `MAX_STAKE`.

### Provably-fair RNG for casino games
- **Where:** the in-memory crash engine uses a deterministic hash of round
  id; dice/slots use `Math.random()`.
- **Fix:** Commit-reveal scheme — server publishes `serverSeedHash` before
  the round, reveals `serverSeed` after settlement, client supplies
  `clientSeed`. Schema already has the columns
  ([prisma/schema.prisma](prisma/schema.prisma) `CasinoBet.seedServerHash`).

### Deploy contracts and populate env addresses
- The `NEXT_PUBLIC_*_ADDRESS` env vars all default to the zero address.
  `contractsDeployed()` in [src/lib/wagmi.ts](src/lib/wagmi.ts) reports
  `false` until you fill them in.
- Run `npm --prefix packages/contracts run deploy:arc`, copy the addresses
  into `.env.local`, restart.

### Admin governance & key custody: multisig/timelock + KMS verification (Gap 4)
- **Where:** `BettingCore`, `LiquidityPool`, `CasinoHouse`, and `CrashGame` gate
  `_authorizeUpgrade`, `withdrawBankroll`, `setHouseEdge`, and role grants
  behind `DEFAULT_ADMIN_ROLE`.
- **Pre-launch Governance:** Confirm that `DEFAULT_ADMIN_ROLE` across ALL core contracts
  (`BettingCore` and `LiquidityPool` especially, since they back the shared pool) is held
  by a Gnosis Safe multisig (≥2/3 threshold), ideally behind a 48h OZ TimelockController.
  An upgradeable proxy with one EOA holding `DEFAULT_ADMIN_ROLE` is a single point of total system failure.
- **Operator Key Custody (KMS/HSM):** `OPERATOR_PRIVATE_KEY` (or `OPERATOR_PRIVATE_KEY_BETTING`, `_CASINO`, `_CRASH`)
  signs low-trust automated operational transactions (`settleMarket`, `voidBet`, `settleGame`, `resolveRound`).
  For mainnet deployment with real funds, replace raw env-var private keys in `src/lib/server/operatorWallet.ts`
  with a cloud KMS (AWS KMS / GCP Cloud HSM) or a dedicated low-balance hot wallet (gas only)
  behind a key management service.
- **Verification:** Run `npx tsx scripts/verify-admin-governance.ts` —
  it scans `RoleGranted` events for every contract and verifies whether active admins are smart contracts.
- **Action items:**
  1. Deploy a Safe multisig with ≥2/3 threshold on Arc mainnet/testnet
  2. Transfer `DEFAULT_ADMIN_ROLE` on `BettingCore`, `LiquidityPool`, `CasinoHouse`, `CrashGame` to the multisig
  3. Revoke `DEFAULT_ADMIN_ROLE` from all deployer EOAs
  4. Configure distinct low-balance hot wallet addresses or KMS key IDs in `operatorWallet.ts`

### Operational readiness checklist (Fix #7)
- **Structured error tracking:** Either install `@sentry/nextjs` (scaffold
  ready in `instrumentation.ts`) or configure JSON log forwarding to a log
  aggregator. The `logger.ts` module outputs structured JSON in production.
- **Load testing:** Simulate concurrent play across casino + crash games
  and verify bankroll math holds (totalPendingExposure tracking on
  CasinoHouse, maxPotentialPayout on CrashGame).
- **Crash worker process supervision:** The crash round lifecycle lives in
  one stateful worker process. Add process monitoring (systemd, Docker
  health checks, or k8s liveness probes) and alerting on crash/restart.
  The new `cancelStuckRound` escape hatch (30-minute timeout) + bootstrap
  recovery handles the downtime scenario, but the worker should be
  auto-restarted promptly.
- **Written runbooks:**
  1. "Operator key compromised" — revoke `OPERATOR_ROLE` from the
     compromised address, rotate key in env, redeploy workers.
  2. "Bankroll can't cover pending payouts" — pause new bets
     (`CrashGame.pause()`), top up bankroll via `depositBankroll()`,
     investigate root cause.
  3. "Crash worker died mid-round" — the on-chain `cancelStuckRound()`
     auto-refunds after 30 min. Force-cancel manually via
     `cast send CrashGame cancelStuckRound(roundId)` if faster recovery
     is needed.

---

## 🟠 P1 — must land before public launch

### Rate limiting backed by Redis
- **Where:** [src/middleware.ts](src/middleware.ts) currently uses an
  in-memory `Map`. On multi-replica deployments each pod has its own
  bucket so the effective limit multiplies.
- **Fix:** Swap the in-memory bucket for a Redis sorted-set sliding window
  (`ZADD` + `ZCOUNT` + `EXPIRE`). The `redis()` singleton is already in
  [src/lib/server/redis.ts](src/lib/server/redis.ts).

### Migrate `WalletButton` from `walletStore` to wagmi hooks
- **Where:** [src/lib/walletStore.ts](src/lib/walletStore.ts) still does
  direct `window.ethereum` calls and fakes the USDC balance via
  `Math.random()`. Wagmi infrastructure is now ready.
- **Fix:**
  1. Replace `connect()` with `useConnect`/`useDisconnect` from wagmi.
  2. Replace `balanceUsdc` with `useUsdcBalance` from
     [src/lib/useWalletBalance.ts](src/lib/useWalletBalance.ts).
  3. Replace SIWE signing with `useSignMessage` + the existing
     `Auth.verify` API route.
  4. Delete `connectDev` — it bypasses signature verification and must
     never reach production.

### Zod schemas on every API route
- Today most routes parse the JSON body without validation. Standardize
  via the helpers in [src/lib/server/api-error.ts](src/lib/server/api-error.ts):
  ```ts
  const body = MyZodSchema.safeParse(await req.json());
  if (!body.success) return validationError(body.error);
  ```
- Highest priority: `POST /api/bets`, `POST /api/liquidity/deposit`,
  `POST /api/auth/verify`, anything under `/api/admin/`.

### Replace `mockData.ts` consumption on pages
- [src/lib/mockData.ts](src/lib/mockData.ts) is still imported by several
  pages including [src/components/layout/LiveScoreTicker.tsx](src/components/layout/LiveScoreTicker.tsx).
- Replace with `fetch('/api/markets/live')` (which in turn hits
  [src/lib/server/oracle-proxy.ts](src/lib/server/oracle-proxy.ts)).

### Smart-contract test coverage + Slither/Mythril pass
- Add fuzz tests for `BettingCore.placeBet → settleMarket → claimWinnings`
  and `MarketLiquidityPool.deposit → settlePool → executeWithdrawal`.
- Run `slither .` and address every Medium+ finding.
- Schedule an external audit before mainnet (Trail of Bits, OpenZeppelin,
  Spearbit, etc.).

---

## 🟡 P2 — quality-of-life / scale

### Background worker for oracle → Postgres write-through
- The oracle publishes `market:sync`, `odds:update`, `market:live`,
  `market:finished` to Redis channels. Next.js doesn't consume them yet.
- Add a small worker (separate process) that subscribes and upserts into
  Postgres so the UI doesn't have to round-trip Redis for every read.

### Observability
- Wire Sentry (or OTel) into `instrumentation.ts` — the hook is ready.
- Export Prometheus metrics from the oracle (already uses pino).
- Add `/api/health/detailed` checks: Postgres up, Redis up, oracle up,
  quota remaining > 10.

### CI/CD pipeline
- GitHub Actions: typecheck, lint, vitest, hardhat test on every PR.
- Deploy on tag push (Fly.io / Render / Vercel — pick one).
- Auto-generate ABI bindings in `packages/sdk/src/contracts/abis/` from
  the hardhat artifacts.

### Casino game persistence
- All casino bets currently die when the Node process restarts. The
  Prisma `CasinoBet` model is ready; wire `/api/casino/*` to use it.

### Admin pages
- [/admin/analytics](src/app/admin/analytics/page.tsx) reads from the
  in-memory store. Migrate to Prisma queries + Redis-cached aggregates.

### Internationalization
- Currency formatting hard-codes USD via `toLocaleString('en-US')`. If you
  intend to support EU/UK users, plumb a locale through `next-intl`.

### Legal compliance
- Geofencing for restricted jurisdictions (KYC / IP block).
- Responsible-gambling features: deposit limits, self-exclusion, session
  reminders. None exist today.
- Terms of Service + Privacy Policy pages are missing.

---

## ✅ Done in the local-real-stack session

- `npm run dev` orchestration at the repo root that brings up Postgres +
  Redis via docker-compose, then runs Next.js + the oracle in parallel.
  See [package.json](package.json) scripts.
- `.env.example` files for the root, oracle, and contracts packages.
- Real `ApiFootballClient` in
  [packages/oracle/src/providers/api-football.client.ts](packages/oracle/src/providers/api-football.client.ts)
  with quota gating, exponential backoff, and header-driven quota updates.
  `USE_MOCK_PROVIDER` now defaults to `false`.
- Env validation at server startup via
  [instrumentation.ts](instrumentation.ts) + [src/lib/env.ts](src/lib/env.ts).
- Security headers (CSP, HSTS, Permissions-Policy, etc.) +
  per-IP rate-limit middleware in
  [next.config.ts](next.config.ts) + [src/middleware.ts](src/middleware.ts).
- BettingCore hardening: bet rejection past `closesAt`,
  `PayoutSumMismatch` custom error, `MAX_SETTLE_BATCH` cap to prevent
  unbounded settlement loops.
- Wagmi + RainbowKit + react-query mounted via
  [src/components/integration/Web3Provider.tsx](src/components/integration/Web3Provider.tsx).
- `useUsdcBalance` hook reading real on-chain balance +
  allowance against any spender.
- Prisma schema covering users, markets, bets, parlays, LP positions,
  casino bets, follows, notifications, audit logs. Singleton client at
  [src/lib/server/db.ts](src/lib/server/db.ts).
- Singleton Redis client with separate publisher/subscriber at
  [src/lib/server/redis.ts](src/lib/server/redis.ts).
- Standardized API error shape via
  [src/lib/server/api-error.ts](src/lib/server/api-error.ts).
- Oracle data proxy with Redis-first / HTTP-fallback strategy at
  [src/lib/server/oracle-proxy.ts](src/lib/server/oracle-proxy.ts).
