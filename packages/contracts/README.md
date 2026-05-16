# @sportystake/contracts

Smart contracts powering SportyStake.com — a non-custodial USDC sportsbook +
casino deployed on the Arc EVM chain.

## Stack

- Solidity 0.8.24
- Hardhat + TypeScript + hardhat-deploy
- OpenZeppelin v5 (`SafeERC20`, `ReentrancyGuard`, `Pausable`, `AccessControl`)
- TypeChain (ethers v6 bindings)

## Contracts

| Contract              | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `BettingCore`         | Bet placement, market lifecycle, settlement, claims                |
| `MarketLiquidityPool` | Per-market LP pool, share accounting, payout liquidity             |
| `MarketPoolFactory`   | Creates `MarketLiquidityPool` instances per market                 |
| `CasinoHouse`         | Operator-settled casino games (dice, slots, blackjack, etc.)       |
| `CrashGame`           | On-chain crash game with auto-cashout and manual cashout           |
| `mocks/MockUSDC`      | Test-only ERC20 with 6 decimals                                    |

USDC (6 decimals) is the **only** supported settlement token.

## Usage

```bash
cp .env.example .env       # fill in RPC + keys
npm run compile
npm test
npm run coverage
npm run deploy:testnet
```

## Deployments

Deployment artifacts are written to `deployments/<network>/` by
`hardhat-deploy`. Run `npm run export-addresses` to emit a flat JSON of
deployed addresses for consumption by the SDK + oracle packages.
