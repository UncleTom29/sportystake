"use client";

import { useEffect, useState } from "react";
import {
  getPendingCasinoBet,
  clearPendingCasinoBet,
  resolveCasinoBetWithRetry,
  type CasinoGameKey,
  type PendingCasinoBet,
} from "@/lib/placeCasinoBet";
import { useNotifications } from "@/lib/notificationStore";
import { explorerTxUrl } from "@/lib/wagmi";

interface Props {
  game: CasinoGameKey;
  onResolved?: (res: {
    outcome: { win: boolean; payout: string; multiplier: number; detail: Record<string, unknown> };
  }) => void;
}

export default function PendingCasinoBetBanner({ game, onResolved }: Props) {
  const [pending, setPending] = useState<PendingCasinoBet | null>(null);
  const [resolving, setResolving] = useState(false);
  const { pushToast } = useNotifications();

  useEffect(() => {
    const p = getPendingCasinoBet(game);
    if (p) setPending(p);
  }, [game]);

  if (!pending) return null;

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await resolveCasinoBetWithRetry(
        {
          game: pending.game,
          txHash: pending.txHash,
          clientSeed: pending.clientSeed,
          ...pending.params,
        },
        3,
      );
      setPending(null);
      clearPendingCasinoBet(game);
      pushToast({
        kind: res.outcome.win ? "success" : "info",
        title: "Bet Resolved Successfully",
        body: res.outcome.win
          ? `Settled: +${res.outcome.payout} USDC credited to your account.`
          : "Settled on-chain.",
      });
      onResolved?.(res);
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Settlement Retry Failed",
        body: (err as Error).message ?? "Please try again in a few moments.",
      });
    } finally {
      setResolving(false);
    }
  };

  const handleDismiss = () => {
    clearPendingCasinoBet(game);
    setPending(null);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-3.5 text-xs text-white shadow-lg">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-warn)]/20 text-[var(--color-warn)] font-bold">
          !
        </span>
        <div>
          <p className="font-bold text-white">Unsettled On-Chain Bet Detected</p>
          <p className="mono text-[11px] text-[var(--color-ink-3)]">
            Tx: <a href={explorerTxUrl(pending.txHash)} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {pending.txHash.slice(0, 10)}…{pending.txHash.slice(-8)}
            </a>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleResolve}
          disabled={resolving}
          className="mono rounded-lg bg-[var(--color-warn)] px-3 py-1.5 font-black uppercase text-[var(--color-bg-0)] hover:bg-yellow-400 disabled:opacity-60"
        >
          {resolving ? "Resolving…" : "Resolve Settlement"}
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg border border-[var(--color-line-2)] px-2.5 py-1.5 font-bold text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
