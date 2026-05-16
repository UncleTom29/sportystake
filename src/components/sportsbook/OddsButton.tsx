"use client";
import { useBetSlip } from "@/lib/betSlipStore";
import { TrendUp, TrendDown } from "@/components/icons/UIIcons";

export type Direction = "up" | "down" | null;

type Props = {
  matchId: string;
  matchLabel: string;
  market: string;
  selection: string;
  label?: string;
  odds: number;
  direction?: Direction;
  disabled?: boolean;
  block?: boolean;
  size?: "sm" | "md";
};

export default function OddsButton({
  matchId,
  matchLabel,
  market,
  selection,
  label,
  odds,
  direction = null,
  disabled,
  block,
  size = "md",
}: Props) {
  const { addSelection, hasSelection } = useBetSlip();
  const active = hasSelection(matchId, market);

  return (
    <button
      type="button"
      onClick={() =>
        addSelection({ matchId, matchLabel, market, selection, odds })
      }
      disabled={disabled}
      className={`group relative flex items-center justify-between gap-2 overflow-hidden rounded-md border transition-colors ${
        size === "sm" ? "h-9 px-2.5" : "h-11 px-3"
      } ${
        active
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/15 text-white"
          : "border-transparent bg-[var(--color-bg-3)] text-white hover:bg-[var(--color-bg-4)]"
      } ${block ? "w-full" : "min-w-[88px]"} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className={`truncate text-[11px] font-medium ${active ? "text-[var(--color-brand-300)]" : "text-[var(--color-ink-3)]"}`}>
        {label ?? selection}
      </span>
      <span className="flex items-center gap-1">
        {direction === "up" && <TrendUp className="h-3 w-3 text-[var(--color-brand-500)]" />}
        {direction === "down" && <TrendDown className="h-3 w-3 text-[var(--color-live)]" />}
        <span className={`mono text-[14px] font-bold ${active ? "text-[var(--color-brand-300)]" : "text-white"}`}>
          {odds.toFixed(2)}
        </span>
      </span>
    </button>
  );
}
