"use client";

import { useEffect, useRef, useState } from "react";
import { PrivyProvider, usePrivy, useWallets, useIdentityToken, getIdentityToken } from "@privy-io/react-auth";
import { arc } from "@/lib/wagmi";
import { useWallet } from "@/lib/walletStore";
import { setPrivyWalletClient } from "@/lib/privyTx";
import { clientEnv } from "@/lib/env";

const PRIVY_APP_ID = clientEnv.NEXT_PUBLIC_PRIVY_APP_ID;

const SYNC_MAX_ATTEMPTS = 10;
const SYNC_RETRY_DELAY_MS = 5000;
const ACTIVE_FETCH_MAX_ATTEMPTS = 3;

function SessionSyncer() {
  const { authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { identityToken } = useIdentityToken();
  const setAddress = useWallet((s) => s.setAddress);
  const clearSession = useWallet((s) => s.clearSession);
  const syncedAddressRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const activeFetchAttemptsRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  // Only use the embedded (Privy-custodied) wallet — NEVER fall back to external wallets like
  // MetaMask. If no embedded wallet is found, activeWallet stays undefined and on-chain signing
  // will gracefully degrade (privyTx.ts throws "Wallet not ready yet" instead of popping MetaMask).
  const activeWallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2");
  const activeAddress = activeWallet?.address;

  useEffect(() => {
    if (!authenticated || !activeAddress) {
      if (syncedAddressRef.current || attemptRef.current || activeFetchAttemptsRef.current) {
        syncedAddressRef.current = null;
        attemptRef.current = 0;
        activeFetchAttemptsRef.current = 0;
        clearSession();
        setPrivyWalletClient(undefined);
      }
      return;
    }

    setAddress(activeAddress as `0x${string}`);

    if (activeWallet) {
      void (async () => {
        try {
          await activeWallet.switchChain(arc.id);
          const provider = await activeWallet.getEthereumProvider();
          const { createWalletClient, custom } = await import("viem");
          const client = createWalletClient({
            account: activeAddress as `0x${string}`,
            chain: arc,
            transport: custom(provider),
          });
          setPrivyWalletClient(client as any);
        } catch (err) {
          console.warn("[PrivyAppProvider] Failed setting wallet client:", err);
        }
      })();
    }

    if (syncedAddressRef.current === activeAddress) return;

    let cancelled = false;

    const scheduleRetryOrGiveUp = () => {
      if (attemptRef.current < SYNC_MAX_ATTEMPTS) {
        attemptRef.current += 1;
        console.warn(`Privy session sync: retrying (${attemptRef.current}/${SYNC_MAX_ATTEMPTS}) in ${SYNC_RETRY_DELAY_MS}ms`);
        setTimeout(() => {
          if (!cancelled) setRetryTick((t) => t + 1);
        }, SYNC_RETRY_DELAY_MS);
      } else {
        console.error(`Giving up on Privy session sync after ${SYNC_MAX_ATTEMPTS} attempts — logging out`);
        void logout();
        clearSession();
      }
    };

    (async () => {
      let token = identityToken;
      if (!token && activeFetchAttemptsRef.current < ACTIVE_FETCH_MAX_ATTEMPTS) {
        activeFetchAttemptsRef.current += 1;
        try {
          token = await getIdentityToken();
        } catch (err) {
          console.error("getIdentityToken() error:", err);
        }
      }
      if (cancelled) return;

      if (!token) {
        scheduleRetryOrGiveUp();
        return;
      }

      try {
        const res = await fetch("/api/auth/privy/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identityToken: token }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`privy session sync failed (${res.status})`);
        const body = await res.json();
        if (body.data?.user) {
          useWallet.getState().setSession({ user: body.data.user, stats: body.data.stats ?? null });
        }
        syncedAddressRef.current = activeAddress;
        attemptRef.current = 0;
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to sync Privy session:", err);
        scheduleRetryOrGiveUp();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, activeAddress, identityToken, logout, setAddress, clearSession, activeWallet, retryTick]);

  return null;
}

export function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSecure(window.isSecureContext);
    }
  }, []);

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: isSecure ? "users-without-wallets" : "off",
          },
        },
        defaultChain: arc,
        supportedChains: [arc],
      }}
    >
      <SessionSyncer />
      {children}
    </PrivyProvider>
  );
}
