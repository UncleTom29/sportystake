/**
 * (Re)hydrates the session from `/api/auth/me` on mount so a page load with
 * a valid `ss_access` cookie lands the user back in the authenticated state
 * without needing to sign in again. Mounted once inside Web3Provider.
 */
"use client";

import { useEffect } from "react";
import { Auth } from "@/lib/api-client";
import { useWallet } from "@/lib/walletStore";

export default function WalletSync() {
  const setSession = useWallet((s) => s.setSession);
  const clearSession = useWallet((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await Auth.me();
        if (!cancelled) setSession({ user: me.user, stats: me.stats });
      } catch {
        // ss_access is only a 15m JWT — it routinely expires mid-session.
        // ss_refresh lasts 30 days, but nothing rotates ss_access from it
        // proactively, so a stale-but-refreshable session must not be
        // treated as logged out until refresh itself has been tried.
        try {
          await Auth.refresh();
          const me = await Auth.me();
          if (!cancelled) setSession({ user: me.user, stats: me.stats });
        } catch {
          if (!cancelled) clearSession();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [setSession, clearSession]);

  return null;
}
