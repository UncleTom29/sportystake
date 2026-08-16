// React hooks entry point. Requires wagmi + @tanstack/react-query peer deps.
export {
  useMarket,
  useBet,
  usePlaceBet,
  useClaimWinnings,
  useClaimRefund,
} from './hooks/useBettingCore.js';

export {
  useLiquidityPoolStats,
  useMarketLocked,
  useLiquidityPosition,
  useLiquidityDeposit,
  useLiquidityRequestWithdrawal,
  useLiquidityExecuteWithdrawal,
} from './hooks/useLiquidityPool.js';

export { useUsdcBalance } from './hooks/useUsdcBalance.js';

// Re-export pure utilities so consumers don't need a second import.
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
