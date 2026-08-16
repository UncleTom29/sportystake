"use client";
import { useBetSlip } from "@/lib/betSlipStore";
import { TrendUp, TrendDown } from "@/components/icons/UIIcons";

export type Direction = "up" | "down" | null;
export type OddsFormat = "decimal" | "fractional" | "american";

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
  format?: OddsFormat;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function toFractional(decimal: number): string {
  const profit = Math.max(0, decimal - 1);
  const denominator = 100;
  const numerator = Math.round(profit * denominator);
  const div = gcd(numerator, denominator);
  return `${Math.floor(numerator / div)}/${Math.floor(denominator / div)}`;
}

function toAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

function formatOdds(decimal: number, format: OddsFormat): string {
  if (format === "fractional") return toFractional(decimal);
  if (format === "american") return toAmerican(decimal);
  return decimal.toFixed(2);
}

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
  format = "decimal",
}: Props) {
  const { addSelection, hasSelection } = useBetSlip();
  const active = hasSelection(matchId, market, selection);

  // Odds must be > 1.00 to be valid. Anything else is "missing" data — the
  // oracle's odds-refresher hasn't run yet, the bookmaker doesn't price this
  // market, or the upstream API returned no value. Render "—" and disable.
  const hasOdds = Number.isFinite(odds) && odds > 1;
  const isDisabled = disabled || !hasOdds;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (hasOdds) {
          addSelection({ matchId, matchLabel, market, selection, odds });
        }
      }}
      disabled={isDisabled}
      className={`group relative flex items-center justify-between gap-1.5 overflow-hidden rounded-md border transition-all ${
        size === "sm" ? "h-9 px-2 md:px-2.5" : "h-10 px-2.5 md:px-3"
      } ${
        active
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/20 text-white shadow-sm"
          : "border-transparent bg-[var(--color-bg-4)] text-white hover:bg-[var(--color-bg-5)]"
      } ${block ? "w-full" : "w-full min-w-0 md:w-auto md:min-w-[80px]"} disabled:cursor-not-allowed disabled:opacity-40`}
      title={hasOdds ? undefined : "Odds not yet available"}
    >
      <span className={`truncate text-[11px] font-medium ${active ? "text-[var(--color-brand-300)]" : "text-[var(--color-ink-3)]"}`}>
        {label ?? selection}
      </span>
      <span className="flex items-center gap-1 shrink-0">
        {hasOdds && direction === "up" && <TrendUp className="h-3 w-3 text-[var(--color-brand-500)]" />}
        {hasOdds && direction === "down" && <TrendDown className="h-3 w-3 text-[var(--color-live)]" />}
        <span className={`mono text-[13px] md:text-[14px] font-bold ${active ? "text-[var(--color-brand-300)]" : hasOdds ? "text-white" : "text-[var(--color-ink-4)]"}`}>
          {hasOdds ? formatOdds(odds, format) : "—"}
        </span>
      </span>
    </button>
  );
}
