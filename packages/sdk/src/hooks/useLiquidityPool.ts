'use client';
import { useMemo } from 'react';
import { useReadContracts, useReadContract, useWriteContract, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { liquidityPoolAbi } from '../contracts/abis/LiquidityPool.js';
import { addresses, type NetworkName } from '../contracts/addresses.js';
import { parseUsdc } from '../utils.js';

const ZERO: Address = '0x0000000000000000000000000000000000000000';

function networkFromChainId(chainId: number): NetworkName {
  if (chainId === addresses.arcMainnet.chainId) return 'arcMainnet';
  return 'arcTestnet';
}

/**
 * Read aggregate stats for the single, protocol-wide LiquidityPool.
 */
export function useLiquidityPoolStats(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const enabled = poolAddress !== ZERO;
  const query = useReadContracts({
    contracts: enabled ? [
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'totalLiquidity', chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'totalShares', chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'lockedForPayouts', chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'virtualLiquidity', chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'getShareValue', chainId },
    ] : [],
    query: { enabled },
  });

  const stats = useMemo(() => {
    if (!query.data) return undefined;
    const [tl, ts, lp, vl, sv] = query.data;
    const totalLiquidity = (tl?.result as bigint | undefined) ?? 0n;
    const totalShares = (ts?.result as bigint | undefined) ?? 0n;
    const lockedForPayouts = (lp?.result as bigint | undefined) ?? 0n;
    const virtualLiquidity = (vl?.result as bigint | undefined) ?? 0n;
    const shareValue = (sv?.result as bigint | undefined) ?? 0n;
    const effectiveCapacity = totalLiquidity + virtualLiquidity;
    const available = effectiveCapacity > lockedForPayouts ? effectiveCapacity - lockedForPayouts : 0n;
    const utilizationBps = effectiveCapacity === 0n ? 0 : Number((lockedForPayouts * 10000n) / effectiveCapacity);
    return {
      totalLiquidity, totalShares, lockedForPayouts, virtualLiquidity,
      effectiveCapacity, shareValue, available, utilizationBps,
    };
  }, [query.data]);

  return { ...query, stats };
}

/**
 * Read how much of the shared pool's capacity is currently locked against a
 * specific market.
 */
export function useMarketLocked(marketId: `0x${string}` | undefined, network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const enabled = !!marketId && poolAddress !== ZERO;
  return useReadContract({
    address: poolAddress,
    abi: liquidityPoolAbi,
    functionName: 'marketLocked',
    args: marketId ? [marketId] : undefined,
    chainId,
    query: { enabled },
  });
}

/**
 * Read the connected user's position in the shared pool.
 */
export function useLiquidityPosition(user: Address | undefined, network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const enabled = poolAddress !== ZERO && !!user;
  const query = useReadContracts({
    contracts: enabled ? [
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'shares', args: [user!], chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'getUserPosition', args: [user!], chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'withdrawalRequestTime', args: [user!], chainId },
      { address: poolAddress, abi: liquidityPoolAbi, functionName: 'WITHDRAWAL_TIMELOCK', chainId },
    ] : [],
    query: { enabled },
  });

  const position = useMemo(() => {
    if (!query.data) return undefined;
    const [sh, pos, wr, timelock] = query.data;
    const shares = (sh?.result as bigint | undefined) ?? 0n;
    const [usdcValue, earnedProfit] = (pos?.result as [bigint, bigint] | undefined) ?? [0n, 0n];
    const requestedAt = (wr?.result as bigint | undefined) ?? 0n;
    const withdrawalTimelock = (timelock?.result as bigint | undefined) ?? 0n;
    const withdrawalUnlocksAt = requestedAt === 0n ? 0n : requestedAt + withdrawalTimelock;
    return { shares, usdcValue, earnedProfit, withdrawalUnlocksAt };
  }, [query.data]);

  return { ...query, position };
}

export function useLiquidityDeposit(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const { writeContractAsync, ...rest } = useWriteContract();
  function deposit(amountUsdc: number | string, account?: Address) {
    return writeContractAsync({
      address: poolAddress, abi: liquidityPoolAbi,
      functionName: 'deposit', args: [parseUsdc(amountUsdc)],
      account, chainId,
    });
  }
  return { ...rest, deposit };
}

export function useLiquidityRequestWithdrawal(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const { writeContractAsync, ...rest } = useWriteContract();
  function request(account?: Address) {
    return writeContractAsync({
      address: poolAddress, abi: liquidityPoolAbi,
      functionName: 'requestWithdrawal', args: [], account, chainId,
    });
  }
  return { ...rest, request };
}

export function useLiquidityExecuteWithdrawal(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const poolAddress = addresses[net].liquidityPool;
  const { writeContractAsync, ...rest } = useWriteContract();
  function execute(account?: Address) {
    return writeContractAsync({
      address: poolAddress, abi: liquidityPoolAbi,
      functionName: 'executeWithdrawal', args: [], account, chainId,
    });
  }
  return { ...rest, execute };
}
