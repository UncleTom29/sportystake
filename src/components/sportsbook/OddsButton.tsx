"use client";
import { useBetSlip } from "@/lib/betSlipStore";

type OddsButtonProps = {
  matchId: string;
  matchLabel: string;
  market: string;
  selection: string;
  odds: number;
  disabled?: boolean;
};

export default function OddsButton({
  matchId,
  matchLabel,
  market,
  selection,
  odds,
  disabled,
}: OddsButtonProps) {
  const { addSelection, hasSelection } = useBetSlip();
  const active = hasSelection(matchId, market);

  return (
    <button
      onClick={() => addSelection({ matchId, matchLabel, market, selection, odds })}
      disabled={disabled}
      className={`flex flex-col items-center justify-center min-w-[72px] px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
        active
          ? "bg-green-500/20 border-green-500 text-green-400"
          : "bg-[#1a2f47] border-[#243447] text-white hover:bg-[#1e88e5]/20 hover:border-[#1e88e5] hover:text-[#1e88e5]"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      <span className="text-xs text-gray-500 font-normal leading-none mb-0.5">{selection}</span>
      <span>{odds.toFixed(2)}</span>
    </button>
  );
}
