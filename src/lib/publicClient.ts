/**
 * Shared read-only viem client for the browser. No wallet/signing capability
 * — writes go through Circle (`circleTx.ts`), this is purely for
 * `readContract`/`waitForTransactionReceipt` against the same `arc` chain
 * `wagmi.ts` is configured with.
 */
import { createPublicClient, http, fallback } from "viem";
import { arc } from "@/lib/wagmi";
import { clientEnv } from "@/lib/env";

let client: ReturnType<typeof createPublicClient> | undefined;

export function getPublicClient() {
  if (!client) {
    client = createPublicClient({
      chain: arc,
      transport: fallback([http(clientEnv.NEXT_PUBLIC_RPC_URL, { retryCount: 4, retryDelay: 500 })]),
      batch: { multicall: true },
    });
  }
  return client;
}
