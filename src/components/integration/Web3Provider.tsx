"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import WalletSync from "@/components/integration/WalletSync";
import { PrivyAppProvider } from "@/components/integration/PrivyAppProvider";

/**
 * Top-of-tree provider for wagmi + react-query + Privy authentication.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              const msg = (error as Error)?.message?.toLowerCase() ?? "";
              if (msg.includes("user rejected") || msg.includes("4")) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyAppProvider>
          <WalletSync />
          {children}
        </PrivyAppProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
