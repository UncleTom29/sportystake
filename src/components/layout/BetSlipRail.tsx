"use client";
import { useState, useEffect } from "react";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { CloseIcon, TicketIcon, ChevronDown, ChevronUp, ZapIcon, UsdcIcon } from "@/components/icons/UIIcons";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { useUsdcBalance } from "@/lib/useWalletBalance";
import { useNotifications } from "@/lib/notificationStore";
import { placeSingleBets, placeParlay } from "@/lib/placeBet";
import { BetSlip } from "@/lib/api-client";
import BookedBetModal from "@/components/sportsbook/BookedBetModal";
import { Gift, Trash2 } from "lucide-react";

type Tab = "singles" | "parlay";

export default function BetSlipRail() {
  const { selections, isOpen, removeSelection, updateStake, clearAll, toggle, loadSelections } = useBetSlip();
  const [tab, setTab] = useState<Tab>("singles");
  const [singleStake, setSingleStake] = useState(0);
  const [parlayStake, setParlayStake] = useState(0);
  const [accept, setAccept] = useState<"any" | "better" | "none">("any");
  const [placing, setPlacing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedData, setBookedData] = useState<{ code: string; totalOdds: number; selections: BetSelection[] } | null>(null);
  const address = useWallet((s) => s.address);
  const authStatus = useWallet((s) => s.authStatus);
  const { signIn } = usePrivyLogin();
  const { balanceFormatted } = useUsdcBalance({ address: address ?? undefined });
  const pushToast = useNotifications((s) => s.pushToast);

  const [accountMode, setAccountMode] = useState<"main" | "bonus">("main");
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [bonusActive, setBonusActive] = useState<boolean>(false);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetch("/api/bonus/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data?.status) {
            setBonusBalance(data.data.status.bonusBalanceUsdc || 0);
            setBonusActive(data.data.status.bonusStatus === "ACTIVE");
          }
        })
        .catch(() => {});
    }
  }, [authStatus]);

  const handlePlace = async () => {
    if (authStatus !== "authenticated") { void signIn(); return; }
    if (!selections.length) return;
    setPlacing(true);
    try {
      if (accountMode === "bonus") {
        if (tab === "singles") {
          pushToast({ kind: "error", title: "Single bets disallowed", body: "Bonus bets must be accumulators with min 10 selections." });
          return;
        }
        if (parlayStake <= 0) { pushToast({ kind: "warn", title: "Enter a stake" }); return; }
        const res = await fetch("/api/bonus/place-bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stakeUsdc: parlayStake,
            selections: selections.map((s) => ({
              matchId: s.matchId,
              marketType: s.market,
              outcome: 0,
              selectionLabel: s.selection,
              oddsX1000: Math.round(s.odds * 1000),
            })),
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          pushToast({
            kind: "success",
            title: "Bonus Accumulator Placed",
            body: `Stake: $${parlayStake} USDC · Remaining Bonus: $${data.data.remainingBonusBalanceUsdc.toFixed(2)}`,
          });
          setBonusBalance(data.data.remainingBonusBalanceUsdc);
          clearAll();
        } else {
          pushToast({ kind: "error", title: "Bonus Bet Failed", body: data.message || "Qualifying rules not met" });
        }
        return;
      }

      if (tab === "singles") {
        if (singleStake <= 0) { pushToast({ kind: "warn", title: "Enter a stake" }); return; }
        const currentSelections = [...selections];
        const { placed, failures } = await placeSingleBets(selections, singleStake);
        if (placed.length) {
          pushToast({ kind: "success", title: `${placed.length} bet${placed.length > 1 ? "s" : ""} placed` });
          const code = placed[0]?.bookingCode;
          if (code) {
            setBookedData({ code, totalOdds: currentSelections[0]?.odds ?? 1, selections: currentSelections });
          }
        }
        if (failures.length) pushToast({ kind: "error", title: `${failures.length} leg(s) failed`, body: failures[0].error });
        if (placed.length && !failures.length) clearAll();
      } else {
        if (parlayStake <= 0) { pushToast({ kind: "warn", title: "Enter a stake" }); return; }
        const currentSelections = [...selections];
        const { parlay, failures } = await placeParlay(selections, parlayStake);
        if (parlay) {
          pushToast({ kind: "success", title: "Parlay placed", body: `${parlay.legs.length} legs @ ${(parlay.combinedOddsX1000 / 1000).toFixed(2)}×` });
          if (parlay.bookingCode) {
            setBookedData({ code: parlay.bookingCode, totalOdds: Number(parlay.combinedOddsX1000) / 1000, selections: currentSelections });
          }
          clearAll();
        }
        else pushToast({ kind: "error", title: "Parlay failed", body: failures[0]?.error ?? "Unknown error" });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Place bet failed", body: (e as Error).message });
    } finally {
      setPlacing(false);
    }
  };

  const handleBookBet = async () => {
    if (!selections.length) return;
    setBooking(true);
    try {
      const res = await BetSlip.book(selections);
      setBookedData({ code: res.code, totalOdds: res.totalOdds, selections });
    } catch (e) {
      pushToast({ kind: "error", title: "Booking failed", body: (e as Error).message });
    } finally {
      setBooking(false);
    }
  };

  const handleLoadCode = async (code: string) => {
    if (!code.trim()) return;
    try {
      const res = await BetSlip.loadBooked(code.trim());
      if (res.selections && res.selections.length) {
        loadSelections(res.selections as BetSelection[]);
        pushToast({
          kind: "success",
          title: "Ticket loaded",
          body: `Code ${res.code} loaded (${res.selections.length} selections)`,
        });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Load code failed", body: (e as Error).message });
    }
  };

  useEffect(() => {
    if (selections.length > 1) setTab((t) => (t === "singles" ? "parlay" : t));
  }, [selections.length]);

  const parlayOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const singlesTotalStake = selections.length * singleStake;
  const singlesTotalReturn = selections.reduce((acc, s) => acc + singleStake * s.odds, 0);
  const parlayReturn = parlayStake * parlayOdds;
  const hasSelections = selections.length > 0;

  const shared = {
    selections,
    tab, setTab,
    removeSelection, clearAll,
    singleStake, setSingleStake,
    parlayStake, setParlayStake,
    parlayOdds, singlesTotalStake, singlesTotalReturn, parlayReturn,
    hasSelections,
    accept, setAccept,
    updateStake,
    placing,
    booking,
    onBook: handleBookBet,
    onLoadCode: handleLoadCode,
    walletConnected: authStatus === "authenticated",
    balance: balanceFormatted,
    accountMode, setAccountMode,
    bonusActive, bonusBalance,
    onPlace: handlePlace,
  };

  return (
    <>
      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div onClick={toggle} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
            <SlipContent {...shared} onClose={toggle} />
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="fixed right-0 top-[104px] bottom-0 z-30 hidden w-[390px] xl:w-[430px] border-l border-[var(--color-line-1)] bg-[var(--color-bg-1)] shadow-2xl lg:flex lg:flex-col">
        <SlipContent {...shared} />
      </aside>

      {/* Booked Bet Modal */}
      {bookedData && (
        <BookedBetModal
          code={bookedData.code}
          totalOdds={bookedData.totalOdds}
          selections={bookedData.selections}
          onClose={() => setBookedData(null)}
        />
      )}
    </>
  );
}

type Sel = BetSelection;

function SlipContent({
  selections,
  tab,
  setTab,
  removeSelection,
  clearAll,
  singleStake,
  setSingleStake,
  parlayStake,
  setParlayStake,
  parlayOdds,
  singlesTotalStake,
  singlesTotalReturn,
  parlayReturn,
  hasSelections,
  accept,
  setAccept,
  onClose,
  updateStake,
  placing,
  booking,
  onBook,
  onLoadCode,
  walletConnected,
  balance,
  accountMode,
  setAccountMode,
  bonusActive,
  bonusBalance,
  onPlace,
}: {
  selections: Sel[];
  tab: Tab;
  setTab: (t: Tab) => void;
  removeSelection: (matchId: string, market: string) => void;
  clearAll: () => void;
  singleStake: number;
  setSingleStake: (n: number) => void;
  parlayStake: number;
  setParlayStake: (n: number) => void;
  parlayOdds: number;
  singlesTotalStake: number;
  singlesTotalReturn: number;
  parlayReturn: number;
  hasSelections: boolean;
  accept: "any" | "better" | "none";
  setAccept: (a: "any" | "better" | "none") => void;
  onClose?: () => void;
  updateStake: (matchId: string, market: string, stake: number) => void;
  placing: boolean;
  booking: boolean;
  onBook: () => void;
  onLoadCode: (code: string) => void;
  walletConnected: boolean;
  balance: string;
  accountMode: "main" | "bonus";
  setAccountMode: (m: "main" | "bonus") => void;
  bonusActive: boolean;
  bonusBalance: number;
  onPlace: () => void;
}) {
  const [loadInput, setLoadInput] = useState("");

  const handleTriggerLoad = () => {
    if (loadInput.trim()) {
      onLoadCode(loadInput.trim());
      setLoadInput("");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3.5 bg-[var(--color-bg-1)]">
        <div className="flex items-center gap-2">
          <TicketIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
          <span className="text-[13px] font-black tracking-wider uppercase text-white">BET SLIP</span>
          {hasSelections && (
            <span className="mono flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand-500)]/15 border border-[var(--color-brand-500)]/30 px-2 text-[11px] font-bold text-[var(--color-brand-500)]">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasSelections && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-ink-3)] transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)]">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Load Code Bar */}
      <div className="border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)]/60 px-3 py-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-2.5 py-1 focus-within:border-[var(--color-brand-500)]/50">
          <TicketIcon className="h-3.5 w-3.5 text-[var(--color-ink-3)] shrink-0" />
          <input
            type="text"
            value={loadInput}
            onChange={(e) => setLoadInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleTriggerLoad()}
            placeholder="Load Booking Code (e.g. 7X9K2W)"
            className="mono w-full bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-[var(--color-ink-4)]"
          />
          <button
            onClick={handleTriggerLoad}
            disabled={!loadInput.trim()}
            className="rounded bg-[var(--color-bg-3)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-500)] transition-colors hover:bg-[var(--color-bg-4)] disabled:opacity-40"
          >
            Load
          </button>
        </div>
      </div>

      {/* Account Selector Pill: Main USDC vs Virtual Bonus Account */}
      {walletConnected && (bonusActive || bonusBalance > 0) && (
        <div className="border-b border-[var(--color-line-1)] bg-[var(--color-bg-2)]/40 p-2">
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--color-bg-0)] p-1 border border-[var(--color-line-1)]">
            <button
              onClick={() => setAccountMode("main")}
              className={`rounded-md py-1.5 text-[11px] font-bold transition-all ${
                accountMode === "main"
                  ? "bg-[var(--color-bg-3)] text-white shadow"
                  : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              Main USDC ({balance})
            </button>
            <button
              onClick={() => setAccountMode("bonus")}
              className={`rounded-md py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                accountMode === "bonus"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow"
                  : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Bonus
              </span>
              <span className="mono font-mono text-[10px]">${bonusBalance.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
        {(["singles", "parlay"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === "parlay" && selections.length < 2}
              className={`relative py-3 text-[12px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "text-white bg-[var(--color-bg-2)]/40" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              {t === "singles" ? "Singles" : `Multi · ${parlayOdds.toFixed(2)}×`}
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-brand-500)]" />}
            </button>
          );
        })}
      </div>

      {/* Selections List Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 bg-[var(--color-bg-0)]/40">
        {!hasSelections ? (
          <EmptyState onLoadCode={onLoadCode} />
        ) : (
          <div className="space-y-2.5 p-3.5">
            {selections.map((sel) => (
              <SelectionRow
                key={`${sel.matchId}-${sel.market}`}
                sel={sel}
                showStake={tab === "singles"}
                stake={sel.stake || singleStake}
                onStake={(v) => updateStake(sel.matchId, sel.market, v)}
                onRemove={() => removeSelection(sel.matchId, sel.market)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasSelections && (
        <div className="border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 shadow-xl">
          {tab === "singles" ? (
            <>
              <StakeInput value={singleStake} onChange={setSingleStake} label="Stake per single" balance={balance} />
              <Quick chips={[5, 10, 25, 50, 100]} onPick={(v) => setSingleStake(v)} />
              <div className="my-2.5 space-y-1 border-t border-[var(--color-line-1)] pt-2">
                <Row label="Total stake" value={`$${singlesTotalStake.toFixed(2)} USDC`} />
                <Row label="Potential return" value={`$${singlesTotalReturn.toFixed(2)} USDC`} accent />
              </div>
            </>
          ) : (
            <>
              <StakeInput value={parlayStake} onChange={setParlayStake} label="Multi Stake" balance={balance} />
              <Quick chips={[5, 10, 25, 50, 100]} onPick={(v) => setParlayStake(v)} />
              <div className="my-2.5 space-y-1 border-t border-[var(--color-line-1)] pt-2">
                <Row label="Total Stake" value={`$${parlayStake.toFixed(2)} USDC`} />
                <Row label="Combined Odds" value={`${parlayOdds.toFixed(2)}×`} />
                <Row label="Potential Return" value={`$${parlayReturn.toFixed(2)} USDC`} accent />
              </div>
            </>
          )}

          <div className="mb-3 flex items-center justify-between rounded-lg bg-[var(--color-bg-2)] px-3 py-1.5 border border-[var(--color-line-1)]">
            <span className="text-[11px] text-[var(--color-ink-3)] font-medium">Accept odds changes</span>
            <div className="flex items-center gap-1">
              {(["any", "better", "none"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAccept(a)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize transition-colors ${
                    accept === a ? "bg-[var(--color-bg-4)] text-white" : "text-[var(--color-ink-3)] hover:text-white"
                  }`}
                >
                  {a === "any" ? "Any" : a === "better" ? "Higher" : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Book Bet & Place Bet */}
          <div className="flex gap-2">
            <button
              onClick={onBook}
              disabled={booking || placing}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-500)]/40 bg-[var(--color-bg-2)] text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-500)] transition-colors hover:bg-[var(--color-brand-500)]/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TicketIcon className="h-4 w-4" />
              {booking ? "Booking…" : "Book Bet"}
            </button>

            <button
              onClick={onPlace}
              disabled={placing || booking}
              className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-500)] text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] shadow-lg shadow-[var(--color-brand-500)]/20 transition-all hover:bg-[var(--color-brand-400)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ZapIcon className="h-4 w-4" />
              {placing
                ? "Submitting…"
                : !walletConnected
                ? "Sign in to bet"
                : tab === "singles"
                ? "Place Singles"
                : "Place Multi Bet"}
            </button>
          </div>

          <p className="mt-2.5 text-center text-[11px] text-[var(--color-ink-4)]">
            {walletConnected ? `Balance: ${balance} USDC · ` : ""}Instant USDC settlement · Zero gas fees
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onLoadCode }: { onLoadCode?: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-2)] ring-1 ring-[var(--color-line-1)]">
        <TicketIcon className="h-6 w-6 text-[var(--color-brand-500)]" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-white">Your bet slip is empty</p>
        <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Select odds on any match or load a booking code</p>
      </div>

      {onLoadCode && (
        <div className="w-full max-w-xs mt-2 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] mb-2">Have a Booking Code?</p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && code.trim() && onLoadCode(code.trim())}
              placeholder="e.g. 7X9K2W"
              className="mono h-9 w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-2.5 text-[12px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)] focus:border-[var(--color-brand-500)]"
            />
            <button
              onClick={() => code.trim() && onLoadCode(code.trim())}
              disabled={!code.trim()}
              className="h-9 rounded-md bg-[var(--color-brand-500)] px-3 text-[12px] font-bold text-[var(--color-bg-0)] transition-colors hover:bg-[var(--color-brand-400)] disabled:opacity-40"
            >
              Load
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionRow({
  sel,
  showStake,
  stake,
  onStake,
  onRemove,
}: {
  sel: Sel;
  showStake: boolean;
  stake: number;
  onStake: (v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3 transition-colors hover:border-[var(--color-line-2)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Market tag & Match status */}
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--color-ink-2)]">
              {sel.market}
            </span>
          </div>

          {/* Selection Name */}
          <p className="mt-1 text-[13px] font-bold text-white leading-tight break-words">
            {sel.selection}
          </p>

          {/* Match Label */}
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-3)] truncate">
            {sel.matchLabel}
          </p>
        </div>

        {/* Odds & Remove */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={onRemove}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-ink-3)] transition-colors hover:bg-rose-500/15 hover:text-rose-400"
            title="Remove selection"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
          <div className="mono rounded-md bg-[var(--color-bg-4)] px-2 py-0.5 text-[13px] font-extrabold text-[var(--color-brand-500)] shadow-sm">
            {sel.odds.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Individual Single Stake Input (in Singles mode) */}
      {showStake && (
        <div className="mt-2 pt-2 border-t border-[var(--color-line-1)] flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--color-ink-3)]">Leg Stake:</span>
          <div className="flex items-center gap-1">
            <span className="mono text-[11px] text-[var(--color-ink-3)]">$</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={stake || ""}
              onChange={(e) => onStake(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="mono h-6 w-20 rounded border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-1.5 text-right text-[11px] font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
            />
            <span className="text-[10px] font-bold text-[var(--color-ink-4)]">USDC</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StakeInput({ value, onChange, label, balance }: { value: number; onChange: (n: number) => void; label: string; balance?: string }) {
  const maxAmount = parseFloat(balance?.replace(/,/g, "") ?? "0") || 0;
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <span className="mono text-[11px] text-[var(--color-ink-3)]">{balance ? `Bal: $${balance}` : "—"}</span>
      </div>
      <div className="flex h-10 items-center rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-3 focus-within:border-[var(--color-brand-500)]/50 transition-colors">
        <UsdcIcon className="h-4 w-4 shrink-0" />
        <span className="mono ml-2 text-[13px] font-bold text-[var(--color-ink-3)]">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          inputMode="decimal"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="mono ml-1 w-full bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
        />
        <button
          onClick={() => onChange(maxAmount)}
          className="ml-2 rounded-md bg-[var(--color-bg-3)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-1)] transition-colors hover:bg-[var(--color-bg-4)]"
        >
          Max
        </button>
      </div>
    </div>
  );
}

function Quick({ chips, onPick }: { chips: number[]; onPick: (n: number) => void }) {
  return (
    <div className="mb-2 grid grid-cols-5 gap-1.5">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="mono rounded-lg bg-[var(--color-bg-2)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] transition-colors hover:bg-[var(--color-bg-3)] hover:text-white border border-[var(--color-line-1)]"
        >
          +${c}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12px]">
      <span className="text-[var(--color-ink-3)]">{label}</span>
      <span className={`mono font-bold ${accent ? "text-[var(--color-brand-500)] text-[13px]" : "text-white"}`}>{value}</span>
    </div>
  );
}

