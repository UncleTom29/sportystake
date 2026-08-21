"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Bets } from "@/lib/api-client";
import type { BetDTO, BetStatus } from "@/lib/types";
import { ChevronLeft, ZapIcon, TrophyIcon, CloseIcon } from "@/components/icons/UIIcons";
import { clientEnv } from "@/lib/env";
import { privyContractWrite } from "@/lib/privyTx";
import { useNotifications } from "@/lib/notificationStore";
import { explorerTxUrl } from "@/lib/wagmi";

type Filter = "ALL" | BetStatus;
const FILTERS: Filter[] = ["ALL", "PENDING", "WON", "LOST", "CANCELLED", "CLAIMED", "REFUNDED"];

const STATUS_STYLE: Record<BetStatus, { label: string; color: string; bg: string }> = {
  WON:       { label: "Won",       color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.08)" },
  LOST:      { label: "Lost",      color: "var(--color-live)",      bg: "rgba(255,45,45,0.08)" },
  PENDING:   { label: "Pending",   color: "var(--color-warn)",      bg: "rgba(255,176,32,0.08)" },
  CANCELLED: { label: "Cancelled", color: "var(--color-ink-3)",     bg: "rgba(255,255,255,0.04)" },
  CLAIMED:   { label: "Claimed",   color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.08)" },
  REFUNDED:  { label: "Refunded",  color: "var(--color-ink-3)",     bg: "rgba(255,255,255,0.04)" },
};

const LEG_RESULT_STYLE: Record<"PENDING" | "WON" | "LOST" | "VOID", { label: string; color: string; bg: string }> = {
  WON:     { label: "Won",     color: "var(--color-brand-500)", bg: "rgba(0,231,1,0.08)" },
  LOST:    { label: "Lost",    color: "var(--color-live)",      bg: "rgba(255,45,45,0.08)" },
  PENDING: { label: "Pending", color: "var(--color-warn)",      bg: "rgba(255,176,32,0.08)" },
  VOID:    { label: "Void",    color: "var(--color-ink-3)",     bg: "rgba(255,255,255,0.04)" },
};

export default function MyBetsPage() {
  const [bets, setBets] = useState<BetDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const pushToast = useNotifications((s) => s.pushToast);

  /** Routes to claimWinnings/claimParlayWinnings depending on bet.parlayId —
   *  a parlay's BetDTO.id is the on-chain parlayId, not a Bet.id, so calling
   *  the single-bet function for one would revert BetNotFound. */
  const handleClaim = async (bet: BetDTO) => {
    setClaimingId(bet.id);
    try {
      const receipt = await privyContractWrite({
        contractAddress: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`,
        abiFunctionSignature: bet.parlayId ? "claimParlayWinnings(bytes32)" : "claimWinnings(bytes32)",
        abiParameters: [bet.id],
      });
      const res = bet.parlayId
        ? await Bets.claimParlay(bet.id, receipt.transactionHash)
        : await Bets.claim(bet.id, receipt.transactionHash);
      const claimedAmount = parseFloat(res.payoutUsdc || "0") || parseFloat(bet.potentialPayout || "0");
      const formattedClaimed = claimedAmount > 0 ? claimedAmount.toFixed(2) : "0.00";
      setBets((cur) => cur.map((b) => b.id === bet.id ? { ...b, status: "CLAIMED", potentialPayout: String(claimedAmount || b.potentialPayout) } : b));
      pushToast({ kind: "success", title: "Winnings claimed", body: `$${formattedClaimed} USDC sent to wallet` });
    } catch (e) {
      pushToast({ kind: "error", title: "Claim failed", body: (e as Error).message });
    } finally {
      setClaimingId(null);
    }
  };

  /** For bets/parlays on a market the operator cancelled (see cancelMarket/
   *  claimRefund and claimParlayRefund in BettingCore.sol) — stake back,
   *  not a payout. Same parlayId branching as handleClaim above. */
  const handleRefund = async (bet: BetDTO) => {
    setClaimingId(bet.id);
    try {
      const receipt = await privyContractWrite({
        contractAddress: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`,
        abiFunctionSignature: bet.parlayId ? "claimParlayRefund(bytes32)" : "claimRefund(bytes32)",
        abiParameters: [bet.id],
      });
      const res = bet.parlayId
        ? await Bets.refundParlay(bet.id, receipt.transactionHash)
        : await Bets.refund(bet.id, receipt.transactionHash);
      const refundedAmount = parseFloat(res.refundUsdc || "0");
      const formattedRefund = refundedAmount > 0 ? refundedAmount.toFixed(2) : "0.00";
      setBets((cur) => cur.map((b) => b.id === bet.id ? { ...b, status: "REFUNDED", potentialPayout: String(refundedAmount || b.potentialPayout) } : b));
      pushToast({ kind: "success", title: "Refund claimed", body: `$${formattedRefund} USDC sent to wallet` });
    } catch (e) {
      pushToast({ kind: "error", title: "Refund failed", body: (e as Error).message });
    } finally {
      setClaimingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchBets = (showLoader = false) => {
      if (showLoader) setLoading(true);
      Bets.my({ status: filter === "ALL" ? undefined : filter, limit: 50 })
        .then((res) => {
          if (cancelled) return;
          setBets(res.items);
          setTotal(res.total);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled && showLoader) setLoading(false); });
    };

    fetchBets(true);
    const interval = setInterval(() => {
      fetchBets(false);
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [filter]);

  const stats = useMemo(() => {
    const won = bets.filter((b) => b.status === "WON" || b.status === "CLAIMED");
    const lost = bets.filter((b) => b.status === "LOST");
    const totalStaked = bets.reduce((s, b) => s + parseFloat(b.amount), 0);
    const netPnl = won.reduce((s, b) => s + parseFloat(b.potentialPayout) - parseFloat(b.amount), 0)
      - lost.reduce((s, b) => s + parseFloat(b.amount), 0);
    return { won: won.length, lost: lost.length, totalStaked, netPnl };
  }, [bets]);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/account" className="flex items-center gap-1 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          Account
        </Link>
        <span>/</span>
        <span className="text-white">My Bets</span>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <SummaryCard label="Total bets" value={String(total)} />
        <SummaryCard label="Won" value={String(stats.won)} accent="var(--color-brand-500)" />
        <SummaryCard label="Lost" value={String(stats.lost)} accent="var(--color-live)" />
        <SummaryCard label="Total staked" value={`$${stats.totalStaked.toFixed(2)}`} />
        <SummaryCard
          label="Net P&L"
          value={`${stats.netPnl >= 0 ? "+" : ""}$${stats.netPnl.toFixed(2)}`}
          accent={stats.netPnl >= 0 ? "var(--color-brand-500)" : "var(--color-live)"}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 shrink-0 flex-1 rounded text-[12px] font-semibold transition-colors ${
              filter === f ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bets list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-bg-2)]" />
          ))}
        </div>
      ) : bets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] py-16 text-center">
          <TrophyIcon className="h-8 w-8 text-[var(--color-ink-4)]" />
          <p className="text-[13px] text-[var(--color-ink-2)]">No bets in this category</p>
          <Link href="/sportsbook" className="text-[12px] text-[var(--color-brand-500)] hover:underline">Browse markets →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bets.map((bet) => {
            const style = STATUS_STYLE[bet.status];
            const expanded = expandedId === bet.id;
            return (
              <div
                key={bet.id}
                className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]"
                style={{ borderLeftColor: style.color, borderLeftWidth: 3 }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{bet.marketLabel}</span>
                        {bet.isLive && (
                          <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      {bet.parlayId ? (
                        <>
                          <p className="font-bold text-white">{bet.legs?.length ?? 0}-Leg Parlay</p>
                          <p className="text-[13px] text-[var(--color-ink-2)]">
                            Combined odds
                            <span className="mx-1">@</span>
                            <span className="mono font-bold text-[var(--color-warn)]">{(bet.oddsX1000 / 1000).toFixed(2)}</span>
                          </p>
                        </>
                      ) : bet.isCasino ? (
                        <>
                          <p className="font-bold text-white">{bet.marketLabel}</p>
                          <p className="text-[13px] text-[var(--color-ink-2)]">
                            {bet.status === "PENDING"
                              ? "Awaiting result"
                              : bet.status === "CANCELLED"
                                ? "Round cancelled — stake refunded"
                                : bet.status === "LOST"
                                  ? "No payout"
                                  : (
                                    <>Won @ <span className="mono font-bold text-[var(--color-warn)]">{bet.selectionLabel}</span></>
                                  )}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-white">{bet.marketType}</p>
                            {bet.homeScore !== undefined && bet.awayScore !== undefined && (
                              <span className="mono shrink-0 rounded bg-[var(--color-bg-1)] px-2 py-0.5 text-[11px] font-bold text-white border border-[var(--color-line-1)]">
                                {bet.homeScore} - {bet.awayScore}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] text-[var(--color-ink-2)]">
                            <span className="font-semibold">{bet.selectionLabel}</span>
                            <span className="mx-1">@</span>
                            <span className="mono font-bold text-[var(--color-warn)]">{(bet.oddsX1000 / 1000).toFixed(2)}</span>
                          </p>
                        </>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className="mono inline-block rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {style.label}
                      </span>
                      <p className="mono mt-1 text-[12px] text-[var(--color-ink-3)]">${parseFloat(bet.amount).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
                    <span className="text-[var(--color-ink-3)]">Stake: <span className="mono font-bold text-white">${parseFloat(bet.amount).toFixed(2)}</span></span>
                    <span className="text-[var(--color-ink-3)]">
                      {bet.status === "WON" || bet.status === "CLAIMED" ? "Won" : bet.status === "REFUNDED" ? "Refunded" : "Potential"}:
                      <span className="mono font-bold ml-1" style={{ color: style.color }}>
                        ${parseFloat(bet.potentialPayout).toFixed(2)}
                      </span>
                    </span>
                    <span className="text-[var(--color-ink-3)]">{new Date(bet.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {bet.txHash && (
                      <a
                        href={explorerTxUrl(bet.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[var(--color-info)] hover:underline"
                      >
                        {bet.txHash.slice(0, 12)}…
                      </a>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {bet.status === "WON" && !bet.isCasino && (
                      <button
                        onClick={() => void handleClaim(bet)}
                        disabled={claimingId === bet.id}
                        className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ZapIcon className="h-3.5 w-3.5" />
                        {claimingId === bet.id ? "Claiming…" : `Claim $${parseFloat(bet.potentialPayout).toFixed(2)}`}
                      </button>
                    )}
                    {bet.status === "CANCELLED" && !bet.isCasino && (
                      <button
                        onClick={() => void handleRefund(bet)}
                        disabled={claimingId === bet.id}
                        className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ZapIcon className="h-3.5 w-3.5" />
                        {claimingId === bet.id ? "Refunding…" : `Claim Refund $${parseFloat(bet.amount).toFixed(2)}`}
                      </button>
                    )}
                    {/* A parlay never itself flips to CANCELLED before the
                        refund tx — claimParlayRefund only succeeds once one
                        leg's market was cancelled and no other leg lost, so
                        the parlay can still read PENDING right up until the
                        claim. Surface it opportunistically off that leg
                        signal; the contract call is the real authority and
                        fails gracefully (toast) if not actually eligible. */}
                    {bet.status === "PENDING" && bet.parlayId && bet.legs?.some((l) => l.marketStatus === "CANCELLED") && (
                      <button
                        onClick={() => void handleRefund(bet)}
                        disabled={claimingId === bet.id}
                        className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ZapIcon className="h-3.5 w-3.5" />
                        {claimingId === bet.id ? "Refunding…" : `Claim Refund $${parseFloat(bet.amount).toFixed(2)}`}
                      </button>
                    )}
                    {bet.parlayId && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : bet.id)}
                        className="flex h-8 items-center gap-1 rounded-md border border-[var(--color-line-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
                      >
                        {expanded ? <CloseIcon className="h-3.5 w-3.5" /> : <TrophyIcon className="h-3.5 w-3.5" />}
                        {expanded ? "Hide legs" : `View ${bet.legs?.length ?? 0} legs`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Individual matches played in this parlay — the button
                    above existed before but never rendered anything. */}
                {bet.parlayId && expanded && (
                  <div className="divide-y divide-[var(--color-line-1)] border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
                    {(bet.legs ?? []).map((leg, i) => {
                      const legStyle = LEG_RESULT_STYLE[leg.result];
                      const hasScore = leg.homeScore !== undefined && leg.awayScore !== undefined;
                      const isLive = leg.marketStatus === "LIVE";
                      return (
                        <div key={`${leg.marketId}-${i}`} className="px-4 py-3 text-[12px]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[var(--color-ink-3)]">
                              <span className="mono">{i + 1}</span>
                              <span>
                                {new Date(leg.matchTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isLive && (
                                <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] animate-pulse" />
                                  LIVE
                                </span>
                              )}
                            </div>
                            <span
                              className="mono shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: legStyle.bg, color: legStyle.color }}
                            >
                              {legStyle.label}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-white">
                              {leg.homeTeam && leg.awayTeam ? `${leg.homeTeam} vs ${leg.awayTeam}` : leg.marketLabel}
                            </p>
                            {hasScore && (
                              <span className="mono shrink-0 font-bold text-white">{leg.homeScore} - {leg.awayScore}</span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[var(--color-ink-3)]">
                            <span>Pick: <span className="font-semibold text-[var(--color-ink-1)]">{leg.selectionLabel}</span></span>
                            <span>Market: <span className="font-semibold text-[var(--color-ink-1)]">{leg.marketType ?? "—"}</span></span>
                            <span>
                              Odds: <span className="mono font-bold text-[var(--color-warn)]">{(leg.oddsX1000 / 1000).toFixed(2) === "0.00" ? "—" : (leg.oddsX1000 / 1000).toFixed(2)}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</p>
      <p className="mono mt-1 text-lg font-black" style={{ color: accent ?? "white" }}>{value}</p>
    </div>
  );
}
