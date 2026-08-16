"use client";

import { useState } from "react";
import type { BetSelection } from "@/lib/betSlipStore";
import { CloseIcon, TicketIcon, ZapIcon } from "@/components/icons/UIIcons";
import { useNotifications } from "@/lib/notificationStore";

interface BookedBetModalProps {
  code: string;
  totalOdds: number;
  selections: BetSelection[];
  onClose: () => void;
}

export default function BookedBetModal({
  code,
  totalOdds,
  selections,
  onClose,
}: BookedBetModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const pushToast = useNotifications((s) => s.pushToast);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sportystake.com";
  const shareUrl = `${origin}/sportsbook?bookCode=${encodeURIComponent(code)}`;
  const shareText = `Check out my bet ticket on SportyStake! Code: ${code} (${selections.length} legs @ ${totalOdds.toFixed(2)}x)`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      pushToast({ kind: "success", title: "Booking code copied", body: code });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      pushToast({ kind: "error", title: "Copy failed" });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      pushToast({ kind: "success", title: "Share link copied" });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      pushToast({ kind: "error", title: "Copy failed" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 shadow-2xl transition-all">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-32 w-64 rounded-full bg-[var(--color-brand-500)]/20 blur-3xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-2)] text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-3)] hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <TicketIcon className="h-6 w-6" />
          </div>

          <h3 className="text-lg font-black tracking-tight text-white">Bet Ticket Booked!</h3>
          <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
            Share this code or link with friends to let them load your exact ticket.
          </p>

          {/* Booking Code Display Box */}
          <div className="mt-5 rounded-xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-4 shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-3)]">
              BOOKING CODE
            </span>
            <div className="mt-1 flex items-center justify-center gap-3">
              <span className="mono text-2xl font-black tracking-wider text-[var(--color-brand-500)]">
                {code}
              </span>
              <button
                onClick={handleCopyCode}
                className="rounded-lg bg-[var(--color-brand-500)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-bg-0)] transition-transform active:scale-95 hover:bg-[var(--color-brand-400)]"
              >
                {copiedCode ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Ticket Specs */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--color-bg-2)] px-4 py-2.5 text-[12px]">
            <span className="text-[var(--color-ink-3)]">
              Legs: <strong className="text-white">{selections.length}</strong>
            </span>
            <span className="text-[var(--color-ink-3)]">
              Combined Odds:{" "}
              <strong className="mono font-bold text-[var(--color-brand-500)]">
                {totalOdds.toFixed(2)}x
              </strong>
            </span>
          </div>

          {/* Leg List Preview */}
          <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-0)] p-2 text-left space-y-1.5 scrollbar-thin">
            {selections.map((sel) => (
              <div
                key={`${sel.matchId}-${sel.market}`}
                className="flex items-center justify-between rounded bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11px]"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-white truncate">{sel.selection}</p>
                  <p className="text-[10px] text-[var(--color-ink-3)] truncate">
                    {sel.matchLabel} · {sel.market}
                  </p>
                </div>
                <span className="mono font-bold text-[var(--color-warn)]">
                  {sel.odds.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Share Buttons */}
          <div className="mt-5 space-y-2">
            <button
              onClick={handleCopyLink}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] text-[12px] font-bold text-white transition-colors hover:bg-[var(--color-bg-3)]"
            >
              <ZapIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
              {copiedLink ? "Link Copied!" : "Copy Share Link"}
            </button>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `${shareText} ${shareUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center justify-center rounded-lg bg-[#25D366]/10 text-[11px] font-bold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
              >
                WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  shareUrl
                )}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center justify-center rounded-lg bg-[#229ED9]/10 text-[11px] font-bold text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
              >
                Telegram
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `${shareText} ${shareUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center justify-center rounded-lg bg-[#1DA1F2]/10 text-[11px] font-bold text-[#1DA1F2] transition-colors hover:bg-[#1DA1F2]/20"
              >
                X / Twitter
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
