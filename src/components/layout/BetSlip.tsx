"use client";
import { useBetSlip } from "@/lib/betSlipStore";
import Button from "@/components/ui/Button";

export default function BetSlip() {
  const { selections, isOpen, removeSelection, updateStake, clearAll, toggle } = useBetSlip();

  const totalStake = selections.reduce((sum, s) => sum + s.stake, 0);
  const potentialWin = selections.reduce((sum, s) => sum + s.stake * s.odds, 0);
  const parlayOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const parlayWin = totalStake > 0 ? totalStake * parlayOdds : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 w-full sm:w-96 bg-[#0d1821] border border-white/10 rounded-t-2xl sm:rounded-xl sm:bottom-4 sm:right-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎟️</span>
          <span className="font-bold text-white">Bet Slip</span>
          {selections.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-green-500 text-black text-xs font-black flex items-center justify-center">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selections.length > 0 && (
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
              Clear all
            </button>
          )}
          <button onClick={toggle} className="text-gray-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {["Singles", "Parlay"].map((t) => (
          <button
            key={t}
            className="flex-1 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors first:text-white first:border-b-2 first:border-green-500"
          >
            {t}
          </button>
        ))}
      </div>

      {/* Selections */}
      <div className="max-h-80 overflow-y-auto">
        {selections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
            <span className="text-4xl">🎟️</span>
            <p className="text-sm">Your bet slip is empty</p>
            <p className="text-xs text-gray-600">Click on odds to add selections</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {selections.map((sel) => (
              <div key={`${sel.matchId}-${sel.market}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs text-gray-500">{sel.matchLabel}</p>
                    <p className="text-sm text-white font-medium">{sel.selection}</p>
                    <p className="text-xs text-gray-500">{sel.market}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold text-sm">{sel.odds.toFixed(2)}</span>
                    <button
                      onClick={() => removeSelection(sel.matchId, sel.market)}
                      className="text-gray-600 hover:text-red-400 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">USDT</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    min={0}
                    value={sel.stake || ""}
                    onChange={(e) =>
                      updateStake(sel.matchId, sel.market, parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-[#1a2738] border border-white/10 rounded-lg pl-12 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                  />
                  <div className="flex gap-1 mt-1">
                    {[10, 25, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => updateStake(sel.matchId, sel.market, v)}
                        className="flex-1 text-xs bg-[#1a2738] hover:bg-[#243447] text-gray-400 hover:text-white py-1 rounded-md transition-colors"
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                  {sel.stake > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Win: <span className="text-green-400 font-semibold">{(sel.stake * sel.odds).toFixed(2)} USDT</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {selections.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Total Stake</span>
            <span className="text-white font-medium">{totalStake.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-400">Potential Win</span>
            <span className="text-green-400 font-bold">{potentialWin.toFixed(2)} USDT</span>
          </div>
          {selections.length > 1 && (
            <div className="bg-[#1a2738] rounded-xl p-3 mb-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Parlay Odds</span>
                <span className="text-yellow-400 font-bold">{parlayOdds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Parlay Win</span>
                <span className="text-green-400 font-bold">{parlayWin.toFixed(2)} USDT</span>
              </div>
            </div>
          )}
          <Button variant="primary" fullWidth>
            Place Bet — {totalStake.toFixed(2)} USDT
          </Button>
        </div>
      )}
    </div>
  );
}
