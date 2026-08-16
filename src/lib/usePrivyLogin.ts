"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/lib/walletStore";
import { useCallback } from "react";

export function usePrivyLogin() {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const clearSession = useWallet((s) => s.clearSession);

  const signIn = useCallback(() => {
    login();
  }, [login]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (e) {
      console.warn("Privy logout failed:", e);
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout fetch failed:", e);
    }
    clearSession();
  }, [logout, clearSession]);

  return {
    signIn,
    signOut,
    isSigningIn: !ready,
    authenticated,
    user,
    error: null,
  };
}
