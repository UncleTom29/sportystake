"use client";
import { useState, useEffect } from "react";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { useNotifications } from "@/lib/notificationStore";
import { CloseIcon, ZapIcon, TicketIcon, BadgeCheck } from "@/components/icons/UIIcons";
import { placeSingleBets, placeParlay } from "@/lib/placeBet";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mode: "single" | "parlay";
  stake: number;
};

export default function BetConfirmationModal({ isOpen, onClose, mode, stake }: Props) {
  const { selections, clearAll } = useBetSlip();
  const { pushToast } = useNotifications();
  const [step, setStep] = useState<"confirm" | "placing" | "success" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) { setVisible(true); setStep("confirm"); }
    else setTimeout(() => setVisible(false), 300);
  }, [isOpen]);

  if (!visible || !selections.length) return null;

  const parlayOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const singleReturn = selections.reduce((acc, s) => acc + stake * s.odds, 0);
  const parlayReturn = stake * parlayOdds;
  const totalReturn = mode === "parlay" ? parlayReturn : singleReturn;
  const totalStake = mode === "parlay" ? stake : stake * selections.length;
  const impliedProb = mode === "parlay"
    ? ((1 / parlayOdds) * 100).toFixed(1)
    : ((1 / selections[0].odds) * 100).toFixed(1);

  const handleConfirm = async () => {
    setStep("placing");
    try {
      if (mode === "singles") {
        await placeSingleBets(selections, stake);
      } else {
        await placeParlay(selections, stake);
      }
      setStep("success");
      clearAll();
    } catch (e) {
      setErrorMsg((e as Error).message ?? "Unknown error");
      setStep("error");
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-end justify-center p-4 transition-all md:items-center ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === "confirm" ? onClose : undefined} />
      <div className={`relative w-full max-w-md rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-5 transition-all ${isOpen ? "translate-y-0" : "translate-y-4"}`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-[var(--color-brand-500)]" />
            <h2 className="text-[15px] font-bold text-white">
              {step === "confirm" ? "Confirm bet" : step === "placing" ? "Placing…" : step === "success" ? "Bet placed!" : "Bet failed"}
            </h2>
          </div>
          {step !== "placing" && (
            <button onClick={onClose} className="text-[var(--color-ink-3)] hover:text-white">
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-500)]/10">
              <BadgeCheck className="h-8 w-8 text-[var(--color-brand-500)]" />
            </div>
            <p className="text-center text-[14px] font-bold text-white">
              {mode === "parlay"
                ? `${selections.length}-leg parlay placed @ ${parlayOdds.toFixed(2)}×`
                : `${selections.length} bet${selections.length > 1 ? "s" : ""} placed`}
            </p>
            <p className="text-center text-[12px] text-[var(--color-ink-3)]">
              Potential return: <span className="mono font-bold text-[var(--color-brand-500)]">${totalReturn.toFixed(2)} USDC</span>
            </p>
            <button onClick={onClose} className="w-full rounded-md bg-[var(--color-brand-500)] py-2.5 text-[13px] font-bold text-[var(--color-bg-0)]">
              View in My Bets
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-center text-[14px] font-bold text-[var(--color-live)]">Failed to place bet</p>
            <p className="text-center text-[12px] text-[var(--color-ink-3)]">{errorMsg}</p>
            <div className="flex gap-2">
              <button onClick={handleConfirm} className="rounded-md bg-[var(--color-brand-500)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-0)]">Try Again</button>
              <button onClick={onClose} className="rounded-md border border-[var(--color-line-2)] px-4 py-2 text-[13px] font-semibold text-white">Cancel</button>
            </div>
          </div>
        )}

        {step === "placing" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-500)] border-t-transparent" />
            <p className="text-[13px] text-[var(--color-ink-2)]">Submitting to Arc network…</p>
            <p className="text-[11px] text-[var(--color-ink-3)]">Estimated time: ~5 seconds</p>
          </div>
        )}

        {step === "confirm" && (
          <>
            {/* Selections */}
            <div className="mb-4 space-y-2">
              {selections.map((sel) => (
                <SelectionRow key={`${sel.matchId}-${sel.market}`} sel={sel} />
              ))}
            </div>

            {/* Summary */}
            {mode === "parlay" && selections.length > 1 && (
              <div className="mb-3 flex items-center justify-between rounded-md bg-[var(--color-bg-2)] px-3 py-2">
                <span className="text-[12px] text-[var(--color-ink-3)]">Combined odds</span>
                <span className="mono text-[15px] font-black text-[var(--color-brand-500)]">{parlayOdds.toFixed(2)}×</span>
              </div>
            )}

            <div className="mb-4 space-y-1.5 rounded-md bg-[var(--color-bg-2)] p-3 text-[13px]">
              <Row label={mode === "parlay" ? "Stake" : "Stake per bet"} value={`$${stake.toFixed(2)} USDC`} />
              <Row label="Total stake" value={`$${totalStake.toFixed(2)} USDC`} />
              <Row label="Potential payout" value={`$${totalReturn.toFixed(2)} USDC`} accent />
              <Row label="Implied probability" value={`${impliedProb}%`} />
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-md border border-[var(--color-line-2)] py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]">
                Cancel
              </button>
              <button onClick={handleConfirm} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--color-brand-500)] py-2.5 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
                <ZapIcon className="h-4 w-4" />
                Confirm bet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SelectionRow({ sel }: { sel: BetSelection }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="truncate text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{sel.market}</p>
        <p className="truncate text-[13px] font-bold text-white">{sel.selection}</p>
        <p className="truncate text-[11px] text-[var(--color-ink-3)]">{sel.matchLabel}</p>
      </div>
      <span className="mono shrink-0 text-[14px] font-bold text-[var(--color-brand-500)]">{sel.odds.toFixed(2)}</span>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-3)]">{label}</span>
      <span className={`mono font-bold ${accent ? "text-[var(--color-brand-500)]" : "text-white"}`}>{value}</span>
    </div>
  );
}
