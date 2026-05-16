// Clients
export { BettingClient } from './clients/BettingClient.js';
export type {
  BettingClientOpts,
  PlaceBetParams,
  BetReceipt,
  MarketView,
  BetView,
} from './clients/BettingClient.js';

export { MarketLiquidityClient } from './clients/MarketLiquidityClient.js';
export type {
  MarketLiquidityClientOpts,
  PoolStats,
  UserPosition,
} from './clients/MarketLiquidityClient.js';

// Utils
export {
  USDC_DECIMALS,
  parseUsdc,
  formatUsdc,
  encodeMarketId,
  oddsToX1000,
  oddsFromX1000,
  minOddsWithSlippage,
  Outcomes,
  Markets,
} from './utils.js';
export type { Outcome, MarketKey } from './utils.js';

// Addresses
export {
  addresses,
  getAddresses,
} from './contracts/addresses.js';
export type { NetworkName, ContractAddresses } from './contracts/addresses.js';

// ABIs
export { bettingCoreAbi } from './contracts/abis/BettingCore.js';
export { marketLiquidityPoolAbi } from './contracts/abis/MarketLiquidityPool.js';
export { marketPoolFactoryAbi } from './contracts/abis/MarketPoolFactory.js';
export { casinoHouseAbi } from './contracts/abis/CasinoHouse.js';
export { crashGameAbi } from './contracts/abis/CrashGame.js';
export { erc20Abi } from './contracts/abis/ERC20.js';

// Errors
export {
  SportyStakeSDKError,
  ContractRevertError,
  NetworkMismatchError,
  InsufficientBalanceError,
  UserRejectedError,
  InvalidInputError,
  mapViemError,
} from './errors.js';
