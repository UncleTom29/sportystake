export const liquidityPoolAbi = [
  // --- Functions ---
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    outputs: [{ name: 'sharesMinted', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestWithdrawal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeWithdrawal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'usdcOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lockLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unlockLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'reportMarketResult',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'totalBetAmount', type: 'uint256' },
      { name: 'totalPayoutRequired', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addVirtualLiquidity',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeVirtualLiquidity',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getShareValue',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getUserPosition',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'usdcValue', type: 'uint256' },
      { name: 'earnedProfit', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getEffectiveCapacity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'marketLocked',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shares',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'withdrawalRequestTime',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'bettingCore',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'totalLiquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalShares',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lockedForPayouts',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'virtualLiquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getFreeLiquidity',
    stateMutability: 'view',
    inputs: [{ name: 'settlingMarketId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'WITHDRAWAL_TIMELOCK',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- Events ---
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'lp', type: 'address', indexed: true },
      { name: 'usdcAmount', type: 'uint256', indexed: false },
      { name: 'sharesMinted', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalRequested',
    inputs: [
      { name: 'lp', type: 'address', indexed: true },
      { name: 'unlockAt', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalExecuted',
    inputs: [
      { name: 'lp', type: 'address', indexed: true },
      { name: 'sharesBurned', type: 'uint256', indexed: false },
      { name: 'usdcOut', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityLocked',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalLocked', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityUnlocked',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalLocked', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketResultReported',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'totalBetAmount', type: 'uint256', indexed: false },
      { name: 'totalPayoutRequired', type: 'uint256', indexed: false },
      { name: 'shareValueX1e18', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VirtualLiquidityAdded',
    inputs: [
      { name: 'admin', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VirtualLiquidityRemoved',
    inputs: [
      { name: 'admin', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VirtualLiquidityConsumed',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  // --- Errors ---
  // Confirmed present in the deployed bytecode (packages/contracts wasn't
  // in sync with what's live — see LiquidityPool.sol's own history/lack
  // thereof): verified byte-for-byte via debug_traceTransaction against a
  // reverted lockLiquidity call, not just copied from source. Listing
  // these lets viem decode reverts by name instead of showing a raw
  // 4-byte selector — other real errors likely exist on-chain too but
  // aren't listed here since they weren't independently confirmed.
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  { type: 'error', name: 'DepositTooSmall', inputs: [] },
  { type: 'error', name: 'WithdrawalNotRequested', inputs: [] },
  { type: 'error', name: 'InsufficientVirtualLiquidity', inputs: [] },
  { type: 'error', name: 'UtilizationCapExceeded', inputs: [] },
] as const;
