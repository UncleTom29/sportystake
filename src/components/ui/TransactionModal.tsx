"use client";
import { useEffect, useState } from "react";
import { ZapIcon, CloseIcon, BadgeCheck } from "@/components/icons/UIIcons";

type Step = { label: string; detail?: string };
type Status = "pending" | "success" | "error";

const DEFAULT_STEPS: Step[] = [
  { label: "Preparing transaction" },
  { label: "Awaiting relay" },
  { label: "On-chain" },
  { label: "Confirming" },
  { label: "Complete" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps?: Step[];
  currentStep: number;
  status: Status;
  txHash?: string;
  errorMsg?: string;
  onRetry?: () => void;
};

export default function TransactionModal({
  isOpen, onClose, title, steps = DEFAULT_STEPS, currentStep, status, txHash, errorMsg, onRetry,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) setVisible(true);
    else setTimeout(() => setVisible(false), 300);
  }, [isOpen]);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-[70] flex items-end justify-center p-4 transition-all md:items-center ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 transition-all ${isOpen ? "translate-y-0" : "translate-y-4"}`}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-5 w-5 text-[var(--color-brand-500)]" />
            <h2 className="text-[15px] font-bold text-white">{title}</h2>
          </div>
          {status !== "pending" && (
            <button onClick={onClose} className="text-[var(--color-ink-3)] hover:text-white">
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-500)]/10">
              <BadgeCheck className="h-8 w-8 text-[var(--color-brand-500)]" />
            </div>
            <p className="text-center text-[15px] font-bold text-white">Transaction confirmed!</p>
            {txHash && (
              <button className="mono text-[12px] text-[var(--color-info)] hover:underline">{txHash} ↗</button>
            )}
            <button onClick={onClose} className="mt-2 w-full rounded-md bg-[var(--color-brand-500)] py-2.5 text-[13px] font-bold text-[var(--color-bg-0)]">
              Done
            </button>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-live)]/10">
              <span className="text-3xl">✕</span>
            </div>
            <p className="text-center text-[15px] font-bold text-white">Transaction failed</p>
            {errorMsg && <p className="text-center text-[12px] text-[var(--color-ink-3)]">{errorMsg}</p>}
            <div className="flex gap-2">
              {onRetry && (
                <button onClick={onRetry} className="rounded-md bg-[var(--color-brand-500)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-0)]">
                  Try Again
                </button>
              )}
              <button onClick={onClose} className="rounded-md border border-[var(--color-line-2)] px-4 py-2 text-[13px] font-semibold text-white">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand-500)] transition-all duration-500"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {steps.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={i} className={`flex items-center gap-3 ${active ? "opacity-100" : done ? "opacity-60" : "opacity-30"}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all ${done ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]" : active ? "border-2 border-[var(--color-brand-500)] text-[var(--color-brand-500)]" : "border border-[var(--color-line-2)] text-[var(--color-ink-3)]"}`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-[13px] font-semibold ${active ? "text-white" : "text-[var(--color-ink-2)]"}`}>{step.label}</p>
                      {active && step.detail && <p className="text-[11px] text-[var(--color-ink-3)]">{step.detail}</p>}
                    </div>
                    {active && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent" />
                    )}
                  </div>
                );
              })}
            </div>

            {txHash && (
              <p className="mono text-center text-[11px] text-[var(--color-info)]">TX: {txHash}</p>
            )}
            <p className="text-center text-[11px] text-[var(--color-ink-3)]">
              Do not close this window. This may take a few seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
