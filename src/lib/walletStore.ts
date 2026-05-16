"use client";

import { create } from "zustand";
import { Auth } from "@/lib/api-client";
import type { UserDTO, UserStats, Address } from "@/lib/types";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
}

interface WalletState {
  status: "idle" | "connecting" | "connected" | "error";
  user: UserDTO | null;
  stats: UserStats | null;
  address: Address | null;
  balanceUsdc: string; // display string e.g. "1,247.50"
  chainId: number | null;
  error: string | null;
  hasInjected: boolean;

  bootstrap: () => Promise<void>;
  connect: () => Promise<void>;
  connectDev: (address?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: Eip1193Provider };
  return w.ethereum ?? null;
}

function shortAddr(): Address {
  const hex = Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  return `0x${hex}` as Address;
}

function buildSiweMessage(address: Address, nonce: string, chainId: number, domain: string): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to SportyStake — non-custodial crypto sportsbook",
    "",
    `URI: https://${domain}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export const useWallet = create<WalletState>((set, get) => ({
  status: "idle",
  user: null,
  stats: null,
  address: null,
  balanceUsdc: "0.00",
  chainId: null,
  error: null,
  hasInjected: false,

  bootstrap: async () => {
    set({ hasInjected: !!getProvider() });
    try {
      const me = await Auth.me();
      set({ user: me.user, stats: me.stats, address: me.user.walletAddress, status: "connected" });
      // Mock balance until on-chain reads land
      const bal = (1000 + Math.random() * 5000).toFixed(2);
      set({ balanceUsdc: bal });
    } catch {
      // not signed in
      set({ status: "idle", user: null });
    }
  },

  connect: async () => {
    set({ status: "connecting", error: null });
    const provider = getProvider();
    try {
      let address: Address;
      let chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 12345);
      if (provider) {
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        if (!accounts?.[0]) throw new Error("No account returned");
        address = accounts[0].toLowerCase() as Address;
        const cid = (await provider.request({ method: "eth_chainId" })) as string;
        chainId = parseInt(cid, 16);
        const { nonce } = await Auth.nonce(address);
        const message = buildSiweMessage(address, nonce, chainId, process.env.NEXT_PUBLIC_SIWE_DOMAIN ?? "sportystake.com");
        const signature = (await provider.request({ method: "personal_sign", params: [message, address] })) as string;
        await Auth.verify({ message, signature });
      } else {
        // Dev fallback when no wallet is installed
        await get().connectDev();
        return;
      }
      const me = await Auth.me();
      set({
        status: "connected",
        user: me.user,
        stats: me.stats,
        address: me.user.walletAddress,
        chainId,
        balanceUsdc: (1000 + Math.random() * 5000).toFixed(2),
      });
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  connectDev: async (address?: string) => {
    set({ status: "connecting", error: null });
    try {
      const addr = (address ?? shortAddr()).toLowerCase();
      await Auth.verify({ dev: { address: addr } });
      const me = await Auth.me();
      set({
        status: "connected",
        user: me.user,
        stats: me.stats,
        address: me.user.walletAddress,
        chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 12345),
        balanceUsdc: (1000 + Math.random() * 5000).toFixed(2),
      });
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  disconnect: async () => {
    try { await Auth.logout(); } catch { /* ignore */ }
    set({ status: "idle", user: null, stats: null, address: null, balanceUsdc: "0.00", error: null });
  },

  refresh: async () => {
    try {
      const me = await Auth.me();
      set({ user: me.user, stats: me.stats, address: me.user.walletAddress, status: "connected" });
    } catch {
      set({ status: "idle", user: null });
    }
  },
}));
