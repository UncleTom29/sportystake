"use client";

import { useEffect } from "react";
import { useWallet } from "@/lib/walletStore";
import { useEventStream } from "@/lib/useEventStream";
import { useLiveOdds } from "@/lib/liveOddsStore";
import { useQuotaStore } from "@/lib/quotaStore";
import { useNotifications } from "@/lib/notificationStore";
import type { OddsBundle, QuotaMode } from "@/lib/types";

/**
 * Boots wallet auth (auto-restore on page load) and subscribes to the
 * server-sent event stream for live odds, scores, bet confirmations,
 * LP settlements, quota alerts, and feed events.
 *
 * Drop a single instance high in the tree (e.g. in app/layout.tsx).
 */
export default function IntegrationProvider() {
  const bootstrap = useWallet((s) => s.bootstrap);
  const refreshWallet = useWallet((s) => s.refresh);
  const ingestOdds = useLiveOdds((s) => s.ingest);
  const ingestScore = useLiveOdds((s) => s.ingestScore);
  const setQuota = useQuotaStore((s) => s.setStatus);
  const pushToast = useNotifications((s) => s.pushToast);
  const pushNotification = useNotifications((s) => s.pushNotification);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEventStream(
    ["odds:update", "market:live", "market:finished", "bet:confirmed", "bet:settled", "lp:settled", "quota:alert", "feed:new", "casino:win"],
    (evt) => {
      switch (evt.topic) {
        case "odds:update": {
          const p = evt.payload as { marketId: string; odds: OddsBundle[] };
          if (p?.marketId && p?.odds) ingestOdds(p.marketId, p.odds);
          break;
        }
        case "market:live": {
          const p = evt.payload as { marketId: string; homeScore?: number; awayScore?: number; minute?: number };
          if (p?.marketId) ingestScore(p.marketId, p);
          break;
        }
        case "market:finished": {
          const p = evt.payload as { marketId: string; homeScore?: number; awayScore?: number };
          if (p?.marketId) {
            ingestScore(p.marketId, { ...p, minute: 90 });
            pushNotification({ kind: "system", message: `Market settled: ${p.homeScore}-${p.awayScore}` });
          }
          break;
        }
        case "bet:confirmed": {
          pushToast({ kind: "success", title: "Bet confirmed", body: "On-chain confirmation received." });
          pushNotification({ kind: "bet_confirmed", message: "Your bet was confirmed on-chain." });
          refreshWallet();
          break;
        }
        case "bet:settled": {
          const p = evt.payload as { betId: string; status: "WON" | "LOST" };
          if (p?.status === "WON") {
            pushToast({ kind: "success", title: "Bet won!", body: "Tap to claim winnings." });
            pushNotification({ kind: "bet_won", message: "Your bet won — claim your USDC." });
          } else if (p?.status === "LOST") {
            pushNotification({ kind: "bet_lost", message: "Your bet was settled (lost)." });
          }
          break;
        }
        case "lp:settled": {
          const p = evt.payload as { marketId: string; pnl: string };
          pushNotification({ kind: "lp_settled", message: `LP position settled — P&L ${p.pnl} USDC` });
          break;
        }
        case "quota:alert": {
          const p = evt.payload as { used: number; remaining: number; resetAt: string; mode: QuotaMode };
          if (p) {
            setQuota(p);
            if (p.mode !== "normal") {
              pushToast({ kind: p.mode === "emergency" ? "error" : "warn", title: p.mode === "emergency" ? "Data limit reached" : "Data refresh rate reduced", body: "Showing cached odds.", ttl: 5000 });
            }
          }
          break;
        }
        case "casino:win": {
          const p = evt.payload as { payout: string; game: string };
          if (p?.payout && Number(p.payout) >= 100) {
            pushToast({ kind: "success", title: "Casino win", body: `${p.payout} USDC on ${p.game}` });
          }
          break;
        }
      }
    },
  );

  return null;
}
