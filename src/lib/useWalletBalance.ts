"use client";

import { useReadContracts, useBalance } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CONTRACT_ADDRESSES, ZERO_ADDRESS } from "@/lib/wagmi";

// USDC has 6 decimals on every chain.
export const USDC_DECIMALS = 6;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Reads the connected wallet's USDC balance (and optional allowance against a
 * named spender) directly from chain. Returns formatted strings ready for
 * display alongside the raw bigint for arithmetic.
 *
 * Supports both ERC-20 Circle USDC contract and native Circle USDC on Arc.
 */
export function useUsdcBalance(opts: { address: Address | undefined; spender?: Address }) {
  const usdc = CONTRACT_ADDRESSES.usdc;
  const enabled = !!opts.address && usdc !== ZERO_ADDRESS;

  const usdcAddress = usdc as `0x${string}`;

  const nativeQuery = useBalance({
    address: opts.address,
    query: { enabled: !!opts.address, refetchInterval: 30_000 },
  });

  const query = useReadContracts({
    contracts: (enabled
      ? [
          {
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf" as const,
            args: [opts.address!] as const,
          },
          ...(opts.spender
            ? [{
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: "allowance" as const,
                args: [opts.address!, opts.spender] as const,
              }]
            : []),
        ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : []) as any,
    query: { enabled, refetchInterval: 30_000 },
  });

  const erc20Balance = (query.data?.[0]?.result as bigint | undefined) ?? 0n;
  const nativeBalanceRaw = nativeQuery.data?.value ?? 0n;
  const nativeDecimals = nativeQuery.data?.decimals ?? 18;

  // Convert native Arc 18-decimal gas token balance to 6-decimal USDC units
  const nativeBalance = nativeDecimals > USDC_DECIMALS
    ? nativeBalanceRaw / (10n ** BigInt(nativeDecimals - USDC_DECIMALS))
    : nativeBalanceRaw;
  
  // Prefer ERC-20 balance if non-zero, otherwise fall back to native Arc USDC balance
  const balance = erc20Balance > 0n ? erc20Balance : (nativeBalance > 0n ? nativeBalance : erc20Balance);
  
  const allowance = opts.spender
    ? ((query.data?.[1]?.result as bigint | undefined) ?? 0n)
    : undefined;

  return {
    ...query,
    balance,
    balanceFormatted: formatUsdc(balance),
    allowance,
    allowanceFormatted: allowance !== undefined ? formatUsdc(allowance) : undefined,
  };
}

export function formatUsdc(raw: bigint, digits = 2): string {
  const s = formatUnits(raw, USDC_DECIMALS);
  const [intPart = "0", decPart = ""] = s.split(".");
  if (digits === 0) return Number(intPart).toLocaleString("en-US");
  return `${Number(intPart).toLocaleString("en-US")}.${(decPart + "0".repeat(digits)).slice(0, digits)}`;
}
