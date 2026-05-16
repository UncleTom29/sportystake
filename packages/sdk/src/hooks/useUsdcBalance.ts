'use client';
import { useMemo } from 'react';
import { useReadContracts, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import { addresses, type NetworkName } from '../contracts/addresses.js';
import { formatUsdc, USDC_DECIMALS } from '../utils.js';

function networkFromChainId(chainId: number): NetworkName {
  if (chainId === addresses.arcMainnet.chainId) return 'arcMainnet';
  return 'arcTestnet';
}

/**
 * Reads the connected user's USDC balance and (optionally) their allowance
 * against a given spender (typically a pool or BettingCore).
 */
export function useUsdcBalance(opts: {
  user: Address | undefined;
  spender?: Address;
  network?: NetworkName;
}) {
  const chainId = useChainId();
  const net = opts.network ?? networkFromChainId(chainId);
  const addr = addresses[net];

  const enabled = !!opts.user && addr.usdc !== '0x0000000000000000000000000000000000000000';

  const contracts = enabled ? [
    { address: addr.usdc, abi: erc20Abi, functionName: 'balanceOf' as const, args: [opts.user!] as const, chainId },
    ...(opts.spender ? [{
      address: addr.usdc, abi: erc20Abi, functionName: 'allowance' as const,
      args: [opts.user!, opts.spender] as const, chainId,
    }] : []),
  ] : [];

  const query = useReadContracts({ contracts, query: { enabled } });

  const data = useMemo(() => {
    if (!query.data) return undefined;
    const balance = (query.data[0]?.result as bigint | undefined) ?? 0n;
    const allowance = opts.spender
      ? ((query.data[1]?.result as bigint | undefined) ?? 0n)
      : undefined;
    return {
      balance,
      balanceFormatted: formatUsdc(balance),
      allowance,
      allowanceFormatted: allowance !== undefined ? formatUsdc(allowance) : undefined,
      decimals: USDC_DECIMALS,
      hasAllowance: (required: bigint) =>
        allowance !== undefined && allowance >= required,
    };
  }, [query.data, opts.spender]);

  return { ...query, ...data };
}
