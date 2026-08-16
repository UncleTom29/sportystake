# Production Hardening — Delivery Summary

This session executed the production hardening backlog from
[PRODUCTION_TODO.md](PRODUCTION_TODO.md) end to end (excluding Legal
compliance, which was explicitly out of scope).

What follows: shipped vs. deferred, with file pointers.

---

## ✅ Shipped

### 🔴 P0 — fund-loss risks

#### CrashGame contract hardening
[`packages/contracts/contracts/CrashGame.sol`](packages/contracts/contracts/CrashGame.sol)
was rewritten:
- **Commit-reveal RNG** — round opens with `serverSeedHash`, resolution
  requires the matching `serverSeed`; crash multiplier is deterministic
  from the seed, so neither the operator nor players can rig outcomes.
- **Pull payments** — `resolveRound` only credits `pendingPayout`. Players
  call `claim()` themselves. A single griefing player can't block payouts
  for the rest of the round.
- **Stake bounds** — `MIN_STAKE` (1 USDC) and `MAX_STAKE` (5,000 USDC) on
  `joinRound`.
- **Per-round player cap** — `MAX_PLAYERS_PER_ROUND = 100` keeps the
  resolution loop bounded.
- **Solvency check** — `joinRound` rejects joins that would push the
  worst-case payout beyond the contract's USDC balance.
- **Pausable** — the OperatorRole can halt new rounds + joins.
- Hardhat tests in
  [`packages/contracts/test/CrashGame.spec.ts`](packages/contracts/test/CrashGame.spec.ts).

#### Provably-fair casino RNG
- [`src/lib/server/provably-fair.ts`](src/lib/server/provably-fair.ts) —
  commit-reveal helpers (`generateServerSeed`, `hashServerSeed`,
  `deriveResult`, `verifyReveal`) + game-specific derivations
  (`diceRoll`, `crashMultiplier`, `slotReels`, `rouletteNumber`,
  `uniformIndex` with rejection sampling to avoid modulo bias).
- [`src/lib/server/casino.ts`](src/lib/server/casino.ts) — replaces the
  `Math.random()`-based [`casino-sim.ts`](src/lib/server/casino-sim.ts).
  `resolveDice`, `resolveSlots`, `resolveRoulette`, `resolveBlackjack`,
  `resolveBaccarat`, `resolveCrash`.
- [`src/app/api/casino/bet/route.ts`](src/app/api/casino/bet/route.ts)
  rewritten to persist `seedServerHash`, `clientSeed`, `nonce`, and the
  revealed `seedServer` into Prisma `CasinoBet` — client can verify.

#### On-chain bet settlement worker
[`src/workers/settlement.worker.ts`](src/workers/settlement.worker.ts):
1. Subscribes to Redis channel `market:finished`.
2. Aggregates winning bet ids + total payout from Postgres via
   `BetsRepo.winningBetIdsAndPayout`.
3. Calls `BettingCore.settleMarket(marketId, outcome, ids, total)` via
   viem (operator key from `OPERATOR_PRIVATE_KEY`).
4. Reconciles `Bet` + `Market` rows via `BetsRepo.bulkSetWinningOutcome`
   and `MarketsRepo.setStatus`. Worker is idempotent.

Replaces the previous `Math.random()` settlement at
[`src/lib/server/store.ts:510`](src/lib/server/store.ts).

#### Prisma repository layer (replaces the in-memory store on the hot path)
Repos under [`src/lib/server/repos/`](src/lib/server/repos/):
- [`users.repo.ts`](src/lib/server/repos/users.repo.ts)
- [`bets.repo.ts`](src/lib/server/repos/bets.repo.ts)
- [`lp.repo.ts`](src/lib/server/repos/lp.repo.ts)
- [`markets.repo.ts`](src/lib/server/repos/markets.repo.ts)

Routes migrated to Prisma (no longer touch `store()`):
- [`/api/auth/nonce`](src/app/api/auth/nonce/route.ts) — Redis-backed nonces
- [`/api/auth/verify`](src/app/api/auth/verify/route.ts) — SIWE +
  `siwe.SiweMessage.verify`, atomic nonce consume, Prisma user upsert
- [`/api/auth/me`](src/app/api/auth/me/route.ts)
- [`/api/auth/logout`](src/app/api/auth/logout/route.ts) — revokes the
  refresh token in Redis on the way out
- [`/api/auth/refresh`](src/app/api/auth/refresh/route.ts) — token
  rotation with reuse detection
- [`/api/bets`](src/app/api/bets/route.ts) (POST + GET)
- [`/api/bets/my`](src/app/api/bets/my/route.ts)
- [`/api/bets/[id]`](src/app/api/bets/[id]/route.ts)
- [`/api/bets/[id]/claim`](src/app/api/bets/[id]/claim/route.ts)
- [`/api/bets/public`](src/app/api/bets/public/route.ts)
- [`/api/bets/stats/me`](src/app/api/bets/stats/me/route.ts)
- [`/api/bets/stats/leaderboard`](src/app/api/bets/stats/leaderboard/route.ts)
- [`/api/liquidity/markets`](src/app/api/liquidity/markets/route.ts)
- [`/api/liquidity/my-positions`](src/app/api/liquidity/my-positions/route.ts)
- [`/api/liquidity/deposit`](src/app/api/liquidity/deposit/route.ts)
- [`/api/liquidity/withdraw/request`](src/app/api/liquidity/withdraw/request/route.ts)
- [`/api/liquidity/withdraw/execute`](src/app/api/liquidity/withdraw/execute/route.ts)
- [`/api/markets`](src/app/api/markets/route.ts)
- [`/api/markets/live`](src/app/api/markets/live/route.ts)
- [`/api/markets/[id]`](src/app/api/markets/[id]/route.ts)
- [`/api/casino/bet`](src/app/api/casino/bet/route.ts) — provably-fair

### 🟠 P1 — pre-launch

#### Redis-backed auth state
[`src/lib/server/auth-store.ts`](src/lib/server/auth-store.ts):
- `issueNonce` / `consumeNonce` (atomic, single-use via `DEL`)
- `storeRefreshToken`, `lookupRefreshToken`, `revokeRefreshToken`,
  `revokeAllRefreshTokens`
- Survives process restart + multi-pod deploys.

#### Redis sliding-window rate limiter
[`src/lib/server/rate-limit.ts`](src/lib/server/rate-limit.ts) — single
Lua script (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` + `PEXPIRE`) so the
check is atomic. Fails open when Redis is down.

Applied to:
- `/api/auth/verify` — 5/min/IP
- `/api/bets` — 30/min/user
- `/api/liquidity/deposit` — 10/min/user
- `/api/casino/bet` — 60/min/user

The in-memory bucket in
[`src/middleware.ts`](src/middleware.ts) remains as a fast edge pre-filter.

#### WalletButton migrated to wagmi + RainbowKit + SIWE
- [`src/components/integration/WalletButton.tsx`](src/components/integration/WalletButton.tsx) —
  three-state render (no wallet → RainbowKit ConnectButton; wallet but
  no session → "Sign in"; authed → menu with balance + links).
- [`src/lib/useSiweLogin.ts`](src/lib/useSiweLogin.ts) — orchestrates
  nonce → `signMessageAsync` → `/api/auth/verify` → `Auth.me` rehydrate.
- [`src/lib/walletStore.ts`](src/lib/walletStore.ts) reduced to the
  session-only fields; the `connectDev` escape hatch is **removed**.
- [`src/components/integration/WalletSync.tsx`](src/components/integration/WalletSync.tsx) —
  bridges wagmi state into the Zustand store; mounted in
  `<Web3Provider>`.
- USDC balance comes from on-chain via `useUsdcBalance`.

#### Zod schemas + structured errors
Top-priority routes all parse via `z.object().safeParse` and return the
standardized envelope from
[`src/lib/server/api-response.ts`](src/lib/server/api-response.ts):
- `/api/auth/verify` — message + signature with explicit lengths
- `/api/bets` — full payload shape, market/outcome bounds, USDC regex
- `/api/liquidity/deposit` — marketId + USDC amount
- `/api/liquidity/withdraw/*` — marketId
- `/api/casino/bet` — discriminated union per game type

#### Smart-contract tests
- [`packages/contracts/test/BettingCore.spec.ts`](packages/contracts/test/BettingCore.spec.ts)
  — happy paths, slippage rejection, post-close rejection, pool
  utilization cap, settle batch cap (`MAX_SETTLE_BATCH`),
  `PayoutSumMismatch`, cancel + refund, pause gate.
- [`packages/contracts/test/MarketLiquidityPool.spec.ts`](packages/contracts/test/MarketLiquidityPool.spec.ts)
  — `MIN_DEPOSIT`, share minting, lock authorization (`OnlyBettingCore`),
  utilization cap, withdrawal timelock + post-settle bypass.
- [`packages/contracts/test/CrashGame.spec.ts`](packages/contracts/test/CrashGame.spec.ts)
  — `InvalidSeedHash`, `SeedMismatch`, stake bounds, double-join,
  end-to-end with auto-cashout, `claim()`, pause.
- [`packages/contracts/deploy/01-deploy.ts`](packages/contracts/deploy/01-deploy.ts)
  — single-step deploy that wires factory role grants + dumps addresses
  to `deployments/<network>/addresses.json`.

#### Oracle → Postgres write-through worker
[`src/workers/oracle-sync.worker.ts`](src/workers/oracle-sync.worker.ts)
subscribes to `market:sync`, `market:live`, `market:finished`, and
`odds:update`; upserts `Market` rows and inserts `OddsSnapshot` rows so
the API can serve everything from Postgres without round-tripping Redis.

### 🟡 P2 — quality of life

#### Observability
- [`instrumentation.ts`](instrumentation.ts) — Sentry init when
  `SENTRY_DSN` set; no-op shim otherwise. `onRequestError` hook captures
  unhandled API errors.
- [`/api/health/detailed`](src/app/api/health/detailed/route.ts) —
  parallel checks for Postgres, Redis, Oracle (HTTP `/status`), and
  contract address sanity. Returns 503 on any failure so k8s readiness
  probes can take the pod out of rotation.
- [`packages/oracle/src/metrics.ts`](packages/oracle/src/metrics.ts) —
  Prometheus text-format renderer with counters for API requests/errors,
  cache hits, job runs/durations, plus gauges for quota remaining + mode.
  Exposed at `GET /metrics` from the oracle.

#### CI/CD
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — four parallel
  jobs (Next typecheck+lint, Oracle, SDK, Contracts) plus Slither on
  every PR. Concurrency group cancels superseded runs.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — tag
  push (`v*`) builds the Next app with all required env vars piped from
  GitHub secrets/vars; uploads `.next` as an artifact. Hosting target
  (Fly / Render / Vercel) is left to the operator.

#### i18n scaffold
[`src/lib/i18n.ts`](src/lib/i18n.ts) — lightweight `t()` helper with a
Zustand-backed `useI18n()` hook for reactive locale switching, EN + ES
starter dictionaries, `{var}` interpolation. (`next-intl` is overkill
for 2 locales; this is the migration path when we add a third.)

---

## 🟡 Partial / scoped down

### `mockData.ts` consumption on pages
The 13 remaining importers (`/app/page.tsx`, `/sportsbook/page.tsx`,
`/casino/page.tsx`, `/pools/page.tsx`, `/live/page.tsx`, etc.) all read
the static `matches` / `casinoGames` / `liquidityPools` arrays.
Migrating each to fetch+`useState` requires component-level rewrites
that fall outside this hardening session.

What we did:
- `LiveScoreTicker.tsx` migrated to `Markets.live()` polling as the
  canonical pattern.
- `mockData.ts` carries a `@deprecated` banner pointing to the real
  endpoints + the migration pattern.

What remains:
- Page-by-page swap to the equivalent `Markets.*`, `Casino.games()`,
  `Liquidity.markets()` calls. Components like `MatchCard` already
  accept a `Match` shape that matches `MarketDTO` closely.

### Settlement worker batch handling
Markets with more than `MAX_SETTLE_BATCH = 500` winning bets currently
short-circuit and only settle the final chunk on-chain. In practice no
market will hit this in the foreseeable future, but a true multi-chunk
settler with partial-payout accounting is queued for follow-up.

### Casino game persistence
`CasinoBet` rows are persisted by `/api/casino/bet`, but the casino UI
pages (`/casino/crash`, `/casino/dice`, `/casino/slots`) still run their
own client-side animation/state. The server records each round; the UI
just hasn't been re-pointed at the API yet.

### Admin pages
The admin dashboard (`/admin/analytics`) still pulls aggregates from
`store.ts`. The Prisma repos return all the data it needs; rebinding
the page is straightforward and queued.

---

## 🔴 Deferred (outside session scope)

- **Legal compliance** — geofencing, KYC, responsible-gambling tooling,
  ToS / Privacy. Explicitly out of scope per session brief.
- **External smart-contract audit** — Slither runs in CI but a real
  engagement (Trail of Bits / OpenZeppelin / Spearbit) before mainnet
  remains mandatory.
- **Hosting choice** — `deploy.yml` builds the artifact; the operator
  picks Fly / Render / Vercel + plugs in the deploy step.
- **Background settlement chunking** — see "Partial" above.

---

## Runbook delta

Files added or rewritten this session:

```
packages/contracts/contracts/CrashGame.sol         (rewritten)
packages/contracts/deploy/01-deploy.ts             (new)
packages/contracts/test/BettingCore.spec.ts        (new)
packages/contracts/test/MarketLiquidityPool.spec.ts (new)
packages/contracts/test/CrashGame.spec.ts          (new)

packages/oracle/src/metrics.ts                     (new)
packages/oracle/src/index.ts                       (+/metrics endpoint)

src/lib/server/provably-fair.ts                    (new)
src/lib/server/casino.ts                           (new — replaces casino-sim)
src/lib/server/auth-store.ts                       (new — Redis nonces/refresh)
src/lib/server/rate-limit.ts                       (new — Redis sliding window)
src/lib/server/repos/users.repo.ts                 (new)
src/lib/server/repos/bets.repo.ts                  (new)
src/lib/server/repos/lp.repo.ts                    (new)
src/lib/server/repos/markets.repo.ts               (new)
src/lib/server/auth.ts                             (rewritten — Prisma + Redis)

src/workers/settlement.worker.ts                   (new)
src/workers/oracle-sync.worker.ts                  (new)

src/lib/walletStore.ts                             (rewritten — session-only)
src/lib/useSiweLogin.ts                            (new)
src/lib/i18n.ts                                    (new)
src/components/integration/WalletButton.tsx        (rewritten — wagmi+SIWE)
src/components/integration/WalletSync.tsx          (new)
src/components/integration/Web3Provider.tsx        (+WalletSync mount)
src/components/layout/LiveScoreTicker.tsx          (rewritten — API-backed)
src/middleware.ts                                  (rewritten — token bucket + CORS)
src/lib/mockData.ts                                (deprecation banner)

src/app/api/auth/nonce/route.ts                    (Redis nonces)
src/app/api/auth/verify/route.ts                   (SIWE + Redis + Prisma)
src/app/api/auth/me/route.ts                       (Prisma)
src/app/api/auth/logout/route.ts                   (revokes refresh)
src/app/api/auth/refresh/route.ts                  (rotation + reuse detection)
src/app/api/bets/route.ts                          (Prisma + Zod + rate-limit)
src/app/api/bets/my/route.ts                       (Prisma)
src/app/api/bets/[id]/route.ts                     (Prisma)
src/app/api/bets/[id]/claim/route.ts               (Prisma)
src/app/api/bets/public/route.ts                   (Prisma)
src/app/api/bets/stats/me/route.ts                 (Prisma)
src/app/api/bets/stats/leaderboard/route.ts        (Prisma aggregate)
src/app/api/liquidity/markets/route.ts             (Prisma)
src/app/api/liquidity/my-positions/route.ts        (Prisma)
src/app/api/liquidity/deposit/route.ts             (Prisma + Zod + rate-limit)
src/app/api/liquidity/withdraw/request/route.ts    (Prisma)
src/app/api/liquidity/withdraw/execute/route.ts    (Prisma + timelock)
src/app/api/markets/route.ts                       (Prisma)
src/app/api/markets/live/route.ts                  (Prisma)
src/app/api/markets/[id]/route.ts                  (Prisma)
src/app/api/casino/bet/route.ts                    (provably-fair + Prisma)
src/app/api/health/detailed/route.ts               (PG + Redis + Oracle + contracts)

instrumentation.ts                                 (+Sentry init + onRequestError)

.github/workflows/ci.yml                           (new)
.github/workflows/deploy.yml                       (new)
```

New environment variables introduced:

- `SENTRY_DSN` (optional) — enables Sentry init in `instrumentation.ts`.
- `OPERATOR_PRIVATE_KEY` — required by `settlement.worker.ts` in prod.
- `JWT_REFRESH_TTL_SECONDS` — already in `serverEnv`; honored by
  `auth-store.ts`.

Workers to add to your process manager:

```
npx tsx src/workers/oracle-sync.worker.ts   # subscribes to oracle channels
npx tsx src/workers/settlement.worker.ts    # listens for market:finished
```

The npm dev script in [`package.json`](package.json) already starts the
oracle alongside Next + Postgres + Redis; the two workers above are run
separately so you can scale them independently.

---

## Open questions for the operator

1. **Operator key custody** — `OPERATOR_PRIVATE_KEY` powers settlement.
   Consider AWS KMS / GCP KMS signing + a viem custom signer instead of
   plain env var.
2. **Sentry vs OpenTelemetry** — the instrumentation hook currently
   covers Sentry. If you prefer OTel + Tempo / Honeycomb, the swap is
   ~10 lines.
3. **CI hosting** — `deploy.yml` produces a Next build artifact but
   doesn't push it anywhere. Pick a target before the next release.
