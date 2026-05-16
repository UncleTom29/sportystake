import type { Address } from 'viem';

/**
 * Contract addresses keyed by network. Zero-address placeholders are replaced
 * by deployment scripts. All values are guaranteed to be the same shape.
 */
export const addresses = {
  arcTestnet: {
    chainId: 12345,
    bettingCore: '0x0000000000000000000000000000000000000000' as Address,
    factory: '0x0000000000000000000000000000000000000000' as Address,
    casinoHouse: '0x0000000000000000000000000000000000000000' as Address,
    crashGame: '0x0000000000000000000000000000000000000000' as Address,
    usdc: '0x0000000000000000000000000000000000000000' as Address,
  },
  arcMainnet: {
    chainId: 54321,
    bettingCore: '0x0000000000000000000000000000000000000000' as Address,
    factory: '0x0000000000000000000000000000000000000000' as Address,
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
