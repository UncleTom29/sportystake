/**
 * Wallet/session store. Circle is the source of truth for both identity and
 * the wallet itself.
 */
"use client";

import { create } from "zustand";
import type { UserDTO, UserStats, Address } from "@/lib/types";

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface WalletState {
  /** Session status. */
  authStatus: AuthStatus;
  /** Server-side user record (null until sign-in succeeds). */
  user: UserDTO | null;
  /** Aggregated user stats (bets, wagered, win rate). */
  stats: UserStats | null;
  /** The signed-in user's Circle-provisioned wallet address, mirrored here for convenience. */
  address: Address | null;
  /** Last error from a sign-in attempt. */
  error: string | null;

  setSession: (input: { user: UserDTO; stats: UserStats }) => void;
  setAuthStatus: (status: AuthStatus, error?: string | null) => void;
  setAddress: (address: Address | null) => void;
  clearSession: () => void;
}

export const useWallet = create<WalletState>((set) => ({
  authStatus: "idle",
  user: null,
  stats: null,
  address: null,
  error: null,

  setSession: ({ user, stats }) =>
    set({ user, stats, address: user.walletAddress, authStatus: "authenticated", error: null }),
  setAuthStatus: (status, error = null) => set({ authStatus: status, error }),
  setAddress: (address) => set({ address }),
  clearSession: () =>
    set({ user: null, stats: null, address: null, authStatus: "idle", error: null }),
}));
