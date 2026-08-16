# SportyStake

Non-custodial crypto sportsbook + casino built on the Arc EVM chain.
USDC-only, on-chain settlement, per-market liquidity pools, AI-powered
analytics.

## Quick start

```bash
# 1. install everything (root + oracle + sdk + contracts)
npm run setup

# 2. copy env templates and fill in the secrets
cp .env.example .env.local
cp packages/oracle/.env.example packages/oracle/.env
cp packages/contracts/.env.example packages/contracts/.env

# 3. start the whole stack (Postgres + Redis + Next.js + oracle)
npm run dev
```

`npm run dev` brings up:

| Service        | Port | What it is                                  |
|----------------|------|----------------------------------------------|
| Postgres       | 5432 | App database (docker)                        |
| Redis          | 6379 | Cache + pub/sub (docker)                     |
| Next.js (web)  | 3000 | Frontend + API routes                        |
| Oracle         | 3002 | API-Football ingestion + quota-managed cache |

To stop infra without quitting your shell: `npm run infra:down`.
To wipe data and start clean: `npm run infra:reset`.

## Environment

See [.env.example](.env.example) for the canonical list. Required for
boot:

- `DATABASE_URL` — Postgres
- `REDIS_URL` — Redis
- `JWT_SECRET` — 32+ random bytes (`openssl rand -hex 32`)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` —
  https://cloud.walletconnect.com
- `API_FOOTBALL_KEY` (in `packages/oracle/.env`) — your paid key
- `NEXT_PUBLIC_*_ADDRESS` — set after running
  `npm run contracts:deploy:arc`

Boot will hard-fail with a list of missing/invalid envs.

## Project layout

```
/                       Next.js 16 App Router frontend + API routes
prisma/                 Prisma schema (Postgres)
src/
  app/                  Routes + API
  components/           UI
  lib/                  Stores, env, wagmi, helpers
  lib/server/           Server-only (db, redis, auth, oracle proxy)
packages/
  contracts/            Hardhat + Solidity 0.8.24
  oracle/               API-Football ingestion service (node-cron)
  sdk/                  Viem-based BettingClient + MarketLiquidityClient + wagmi hooks
```

## Production state

This codebase is **in transition** from local-dev to production-ready.
The shippable surface is comprehensively documented in
[PRODUCTION_TODO.md](PRODUCTION_TODO.md). Read it before deploying.

Key things that are NOT yet production-grade:

- API routes still read from an in-memory store
  ([src/lib/server/store.ts](src/lib/server/store.ts)). Prisma schema is
  ready but routes haven't been migrated.
- Casino games use `Math.random()` instead of commit-reveal RNG.
- Wallet connect UI uses both wagmi (new) and a legacy in-memory
  `walletStore` (old) — see PRODUCTION_TODO for the migration list.

## Smart contracts

See [packages/contracts/README.md](packages/contracts/README.md) for the
full architecture. TL;DR:

- `BettingCore` — places, settles, claims bets
- `MarketPoolFactory` — deploys one liquidity pool per market
- `MarketLiquidityPool` — holds USDC backing payouts, mints LP shares
- `CasinoHouse` + `CrashGame` — casino backbone (needs P0 fixes,
  see PRODUCTION_TODO)

Deploy:

```bash
npm run contracts:deploy:local   # hardhat network
npm run contracts:deploy:arc     # Arc testnet
```

## License

UNLICENSED — proprietary.
