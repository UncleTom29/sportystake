'use client';
import { useMemo } from 'react';
import { useReadContract, useWriteContract, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { bettingCoreAbi } from '../contracts/abis/BettingCore.js';
import { addresses, type NetworkName } from '../contracts/addresses.js';
import {
  encodeMarketId,
  minOddsWithSlippage,
  oddsFromX1000,
  parseUsdc,
  type MarketKey,
  type Outcome,
} from '../utils.js';

function networkFromChainId(chainId: number): NetworkName {
  if (chainId === addresses.arcMainnet.chainId) return 'arcMainnet';
  return 'arcTestnet';
}

/**
 * Read a market's on-chain state. Returns parsed fields and a derived
 * `isOpen` boolean that callers can use to enable/disable the bet button.
 */
export function useMarket(opts: {
  fixtureId: number | bigint;
  market: MarketKey | string;
  network?: NetworkName;
}) {
  const chainId = useChainId();
  const network = opts.network ?? networkFromChainId(chainId);
  const addr = addresses[network];
  const marketId = useMemo(
    () => encodeMarketId(opts.fixtureId, opts.market),
    [opts.fixtureId, opts.market],
  );

  const query = useReadContract({
    address: addr.bettingCore,
    abi: bettingCoreAbi,
    functionName: 'markets',
    args: [marketId],
    chainId,
    query: { enabled: addr.bettingCore !== '0x0000000000000000000000000000000000000000' },
  });

  const market = useMemo(() => {
    if (!query.data) return undefined;
    const [pool, closeTime, status, winningOutcome, totalBetAmount, totalPayoutRequired] = query.data;
    return {
      marketId, pool, closeTime, status, winningOutcome, totalBetAmount, totalPayoutRequired,
      isOpen: status === 0, isLive: status === 1, isSettled: status === 2,
    };
  }, [query.data, marketId]);

  return { ...query, marketId, market };
}

/**
 * Read a single bet by id.
 */
export function useBet(betId: `0x${string}` | undefined, network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const addr = addresses[net];
  const query = useReadContract({
    address: addr.bettingCore,
    abi: bettingCoreAbi,
    functionName: 'bets',
    args: betId ? [betId] : undefined,
    chainId,
    query: { enabled: !!betId && addr.bettingCore !== '0x0000000000000000000000000000000000000000' },
  });
  const bet = useMemo(() => {
    if (!query.data) return undefined;
    const [bettor, mid, outcome, amount, oddsX1000, payout, status, placedAt] = query.data;
    return {
      bettor, marketId: mid, outcome, amount, oddsX1000, payout, status, placedAt,
      odds: oddsFromX1000(oddsX1000),
    };
  }, [query.data]);
  return { ...query, bet };
}

/**
 * Submit a placeBet transaction. Caller is responsible for ensuring USDC
 * approval — for the bundled flow use the BettingClient.placeBet method.
 */
export function usePlaceBet(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const addr = addresses[net];
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  function placeBet(params: {
    fixtureId: number | bigint;
    market: MarketKey | string;
    outcome: Outcome;
    amountUsdc: number | string;
    oddsX1000: number | bigint;
    slippageBps?: number;
    account?: Address;
  }) {
    const marketId = encodeMarketId(params.fixtureId, params.market);
    const amount = parseUsdc(params.amountUsdc);
    const oddsX1000 = typeof params.oddsX1000 === 'bigint'
      ? params.oddsX1000
      : BigInt(Math.round(params.oddsX1000));
    const minOdds = minOddsWithSlippage(oddsX1000, params.slippageBps ?? 50);
    return writeContractAsync({
      address: addr.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'placeBet',
      args: [marketId, params.outcome, amount, oddsX1000, minOdds],
      account: params.account,
      chainId,
    });
  }

  return { ...rest, writeContract, writeContractAsync, placeBet };
}

export function useClaimWinnings(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const addr = addresses[net];
  const { writeContractAsync, ...rest } = useWriteContract();
  function claim(betId: `0x${string}`, account?: Address) {
    return writeContractAsync({
      address: addr.bettingCore, abi: bettingCoreAbi,
      functionName: 'claimWinnings', args: [betId], account, chainId,
    });
  }
  return { ...rest, claim };
}

export function useClaimRefund(network?: NetworkName) {
  const chainId = useChainId();
  const net = network ?? networkFromChainId(chainId);
  const addr = addresses[net];
  const { writeContractAsync, ...rest } = useWriteContract();
  function claim(betId: `0x${string}`, account?: Address) {
    return writeContractAsync({
      address: addr.bettingCore, abi: bettingCoreAbi,
      functionName: 'claimRefund', args: [betId], account, chainId,
    });
  }
  return { ...rest, claim };
}
