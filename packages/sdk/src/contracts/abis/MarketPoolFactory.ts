export const marketPoolFactoryAbi = [
  {
    type: 'function',
    name: 'createPool',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'bettingCore', type: 'address' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
  {
    type: 'function',
    name: 'pools',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'pool', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
] as const;
