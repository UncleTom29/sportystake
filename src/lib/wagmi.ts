/**
 * Wagmi configuration. Single source of truth for chains and transports.
 * Imported by `Web3Provider` and (server-side) by any route that needs to
 * read on-chain state.
 *
 * No connectors: identity and the embedded wallet come from Privy
 * (see `usePrivyLogin`), not a wagmi-connected external wallet. This
 * config exists purely for read-only hooks (`useReadContract`, `useBalance`)
 * against a known address.
 */
import { http, createConfig, fallback } from "wagmi";
import { defineChain } from "viem";
import { clientEnv } from "./env";

/**
 * Arc network chain definition. `nativeCurrency` and the mainnet explorer
 * URL are still placeholders — replace once Arc's mainnet metadata is
 * finalized (testnet's explorer URL below is confirmed real, a prior
 * `explorer.arc.network` placeholder here didn't even resolve).
 */
export const arc = defineChain({
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: clientEnv.NEXT_PUBLIC_CHAIN_ID === 12_345 ? "Arc Testnet" : "Arc",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: {
    default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] },
    public: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  // Standard deterministic-deployer address, confirmed deployed on Arc
  // Testnet — lets viem batch parallel readContract calls (pool stats,
  // user positions) into one eth_call instead of N concurrent RPC
  // requests, which the public testnet RPC otherwise rate-limits.
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: clientEnv.NEXT_PUBLIC_CHAIN_ID !== 1,
});

export const wagmiConfig = createConfig({
  chains: [arc],
  connectors: [],
  transports: {
    // The public testnet RPC rate-limits under normal app load (balance
    // polling, pool stats, etc.) — a 429 with no CORS headers shows up in
    // the browser as a misleading "blocked by CORS policy" error rather
    // than the real status, so retrying with backoff matters more here
    // than against a dedicated/paid RPC.
    [arc.id]: fallback([http(clientEnv.NEXT_PUBLIC_RPC_URL, { retryCount: 4, retryDelay: 500 })]),
  },
  ssr: true,
});

/** Block explorer link for a tx hash — the one canonical place this URL
 *  gets built, so a future explorer/chain switch only needs updating here. */
export function explorerTxUrl(txHash: string): string {
  return `${arc.blockExplorers.default.url}/tx/${txHash}`;
}

export const CONTRACT_ADDRESSES = {
  bettingCore: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS,
  liquidityPool: clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS,
  casinoHouse: clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS,
  crashGame: clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS,
  usdc: clientEnv.NEXT_PUBLIC_USDC_ADDRESS,
} as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** True when at least one contract address is still the zero placeholder. */
export function contractsDeployed(): boolean {
  return Object.values(CONTRACT_ADDRESSES).every((a) => a !== ZERO_ADDRESS);
}
