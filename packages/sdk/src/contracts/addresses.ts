import type { Address } from 'viem';

/**
 * Contract addresses keyed by network. Zero-address placeholders are replaced
 * by deployment scripts. All values are guaranteed to be the same shape.
 */
export const addresses = {
  // Real deployment (see packages/contracts/deployments/arcTestnet/addresses.json, deployed
  // 2026-07-27) — this constant just wasn't synced from that file after deploying. usdc here is
  // deliberately the same address the Circuits Protocol monorepo configures as
  // NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS — same chain, same USDC, verified byte-for-byte equal.
  arcTestnet: {
    chainId: 5042002,
    bettingCore: '0x091E1Fe9576E4E090FE95eD8bB25a19B01FAbcf0' as Address,
    liquidityPool: '0x574DF566b98E6f3Cb7459b39BFD9afeD8694A154' as Address,
    casinoHouse: '0x615f95fa5ccCe9Cd79d7aBc0e37983aaDD9f9b9d' as Address,
    crashGame: '0xa7FF5FB348FeEfEf4C092CD67AE62344A33Be8A0' as Address,
    usdc: '0x3600000000000000000000000000000000000000' as Address,
  },
  arcMainnet: {
    chainId: 54321,
    bettingCore: '0x0000000000000000000000000000000000000000' as Address,
    liquidityPool: '0x0000000000000000000000000000000000000000' as Address,
    casinoHouse: '0x0000000000000000000000000000000000000000' as Address,
    crashGame: '0x0000000000000000000000000000000000000000' as Address,
    usdc: '0x0000000000000000000000000000000000000000' as Address,
  },
} as const;

export type NetworkName = keyof typeof addresses;
export type ContractAddresses = (typeof addresses)[NetworkName];

export function getAddresses(network: NetworkName): ContractAddresses {
  const addr = addresses[network];
  if (!addr) {
    throw new Error(`Unknown network: ${String(network)}`);
  }
  return addr;
}
