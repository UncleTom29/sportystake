'use client';
import { useMemo } from 'react';
import { useReadContracts, useReadContract, useWriteContract, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { marketLiquidityPoolAbi } from '../contracts/abis/MarketLiquidityPool.js';
import { addresses, type NetworkName } from '../contracts/addresses.js';
import { parseUsdc } from '../utils.js';

const ZERO: Address = '0x0000000000000000000000000000000000000000';

function networkFromChainId(chainId: number): NetworkName {
  if (chainId === addresses.arcMainnet.chainId) return 'arcMainnet';
  return 'arcTestnet';
}

/**
 * Read aggregate stats for a single MarketLiquidityPool.
 */
export function useMarketPoolStats(poolAddress: Address | undefined) {
  const chainId = useChainId();
  const enabled = !!poolAddress && poolAddress !== ZERO;
  const query = useReadContracts({
    contracts: enabled ? [
      { address: poolAddress, abi: marketLiquidityPoolAbi, functionName: 'totalLiquidity', chainId },
      { address: poolAddress, abi: marketLiquidityPoolAbi, functionName: 'totalShares', chainId },
      { address: poolAddress, abi: marketLiquidityPoolAbi, functionName: 'lockedForPayouts', chainId },
      { address: poolAddress, abi: marketLiquidityPoolAbi, functionName: 'getShareValue', chainId },
      { address: poolAddress, abi: marketLiquidityPoolAbi, functionName: 'settled', chainId },
    ] : [],
    query: { enabled },
  });

  const stats = useMemo(() => {
    if (!query.data) return undefined;
    const [tl, ts, lp, sv, st] = query.data;
    const totalLiquidity = (tl?.result as bigint | undefined) ?? 0n;
    const totalShares = (ts?.result as bigint | undefined) ?? 0n;
    const lockedForPayouts = (lp?.result as bigint | undefined) ?? 0n;
    const shareValue = (sv?.result as bigint | undefined) ?? 0n;
    const settled = (st?.result as boolean | undefined) ?? false;
    const available = totalLiquidity > lockedForPayouts ? totalLiquidity - lockedForPayouts : 0n;
    const utilizationBps = totalLiquidity === 0n ? 0 : Number((lockedForPayouts * 10000n) / totalLiquidity);
    return { totalLiquidity, totalShares, lockedForPayouts, shareValue, settled, available, utilizationBps };
  }, [query.data]);

  return { ...query, stats };
}

/**
 * Read the connected user's position in a single pool.
 */
export function useMarketPoolPosition(opts: {
  poolAddress: Address | undefined;
  user: Address | undefined;
}) {
  const chainId = useChainId();
  const enabled = !!opts.poolAddress && opts.poolAddress !== ZERO && !!opts.user;
  const query = useReadContracts({
    contracts: enabled ? [
      { address: opts.poolAddress!, abi: marketLiquidityPoolAbi, functionName: 'shares', args: [opts.user!], chainId },
      { address: opts.poolAddress!, abi: marketLiquidityPoolAbi, functionName: 'getUserPosition', args: [opts.user!], chainId },
      { address: opts.poolAddress!, abi: marketLiquidityPoolAbi, functionName: 'withdrawalRequests', args: [opts.user!], chainId },
    ] : [],
    query: { enabled },
  });

  const position = useMemo(() => {
    if (!query.data) return undefined;
    const [sh, pos, wr] = query.data;
    const shares = (sh?.result as bigint | undefined) ?? 0n;
    const [usdcValue, earnedProfit] = (pos?.result as [bigint, bigint] | undefined) ?? [0n, 0n];
    const withdrawalUnlocksAt = (wr?.result as bigint | undefined) ?? 0n;
    return { shares, usdcValue, earnedProfit, withdrawalUnlocksAt };
  }, [query.data]);

  return { ...query, position };
}

export function useMarketPoolDeposit(poolAddress: Address | undefined, network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const _addr = addresses[net];
  const { writeContractAsync, ...rest } = useWriteContract();
  function deposit(amountUsdc: number | string, account?: Address) {
    if (!poolAddress) throw new Error('useMarketPoolDeposit: poolAddress required');
    return writeContractAsync({
      address: poolAddress, abi: marketLiquidityPoolAbi,
      functionName: 'deposit', args: [parseUsdc(amountUsdc)],
      account, chainId,
    });
  }
  // _addr is unused but retained for future cross-contract calls.
  void _addr;
  return { ...rest, deposit };
}

export function useMarketPoolRequestWithdrawal(poolAddress: Address | undefined) {
  const chainId = useChainId();
  const { writeContractAsync, ...rest } = useWriteContract();
  function request(account?: Address) {
    if (!poolAddress) throw new Error('poolAddress required');
    return writeContractAsync({
      address: poolAddress, abi: marketLiquidityPoolAbi,
      functionName: 'requestWithdrawal', args: [], account, chainId,
    });
  }
  return { ...rest, request };
}

export function useMarketPoolExecuteWithdrawal(poolAddress: Address | undefined) {
  const chainId = useChainId();
  const { writeContractAsync, ...rest } = useWriteContract();
  function execute(account?: Address) {
    if (!poolAddress) throw new Error('poolAddress required');
    return writeContractAsync({
      address: poolAddress, abi: marketLiquidityPoolAbi,
      functionName: 'executeWithdrawal', args: [], account, chainId,
    });
  }
  return { ...rest, execute };
}

/**
 * Lookup the pool address for a market via BettingCore.markets(marketId).
 * Re-exported here so callers don't need a second hook.
 */
export { useMarket as useMarketLookup } from './useBettingCore.js';
