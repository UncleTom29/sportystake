// Clients
export { BettingClient, ParlayVerdict } from './clients/BettingClient.js';
export type {
  BettingClientOpts,
  PlaceBetParams,
  BetReceipt,
  MarketView,
  BetView,
  PlaceParlayParams,
  ParlayReceipt,
  ParlayView,
} from './clients/BettingClient.js';

export { LiquidityClient } from './clients/LiquidityClient.js';
export type {
  LiquidityClientOpts,
  PoolStats,
  UserPosition,
} from './clients/LiquidityClient.js';

export { CasinoClient, CasinoGameType } from './clients/CasinoClient.js';
export type {
  CasinoClientOpts,
  PlaceCasinoBetParams,
  CasinoBetReceipt,
  CasinoBetView,
} from './clients/CasinoClient.js';

export { CrashClient, CrashRoundStatus } from './clients/CrashClient.js';
export type {
  CrashClientOpts,
  CrashRoundView,
  JoinRoundReceipt,
} from './clients/CrashClient.js';

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
export { liquidityPoolAbi } from './contracts/abis/LiquidityPool.js';
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
