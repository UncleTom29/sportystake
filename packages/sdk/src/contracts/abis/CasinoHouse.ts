// Regenerated from the compiled artifact (packages/contracts/artifacts/contracts/CasinoHouse.sol/CasinoHouse.json)
// to match the actual contract — placeCasinoBet/settleGame, not a
// registered-game pattern. The previous version of this file didn't match
// CasinoHouse.sol at all (stale from an earlier design iteration) and had
// zero callers, so the mismatch went unnoticed until this file's first
// real consumer.
export const casinoHouseAbi = [
  // --- Functions ---
  {
    type: 'function',
    name: 'placeCasinoBet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'game', type: 'uint8' },
      { name: 'clientSeed', type: 'bytes32' },
    ],
    outputs: [{ name: 'requestId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'settleGame',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestId', type: 'bytes32' },
      { name: 'randomResult', type: 'uint256' },
      { name: 'payout', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'depositBankroll',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawBankroll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'bets',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'player', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'game', type: 'uint8' },
      { name: 'clientSeed', type: 'bytes32' },
      { name: 'settled', type: 'bool' },
      { name: 'payout', type: 'uint256' },
      { name: 'reservedExposure', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'nonces',
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
  // --- New functions (Fix #2: exposure check) ---
  {
    type: 'function',
    name: 'setMaxMultiplier',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'game', type: 'uint8' },
      { name: 'multiplierX100', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'maxMultiplierX100',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalPendingExposure',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- Access control views (Fix #4: governance verification) ---
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getRoleMember',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // --- Events ---
  {
    type: 'event',
    name: 'BetReceived',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'game', type: 'uint8', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'clientSeed', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GameSettled',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'randomResult', type: 'uint256', indexed: false },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BankrollDeposit',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BankrollWithdraw',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MaxMultiplierUpdated',
    inputs: [
      { name: 'game', type: 'uint8', indexed: true },
      { name: 'multiplierX100', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;
