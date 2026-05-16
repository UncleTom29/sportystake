"use client";
import { useState, useEffect } from "react";
import { useBetSlip, type BetSelection } from "@/lib/betSlipStore";
import { CloseIcon, TicketIcon, ChevronDown, ChevronUp, ZapIcon, UsdtIcon } from "@/components/icons/UIIcons";
import { useWallet } from "@/lib/walletStore";
import { useNotifications } from "@/lib/notificationStore";
import { placeSingleBets, placeParlay } from "@/lib/placeBet";

type Tab = "singles" | "parlay";

export default function BetSlipRail() {
  const { selections, isOpen, removeSelection, updateStake, clearAll, toggle } = useBetSlip();
  const [tab, setTab] = useState<Tab>("singles");
  const [singleStake, setSingleStake] = useState(0);
  const [parlayStake, setParlayStake] = useState(0);
  const [accept, setAccept] = useState<"any" | "better" | "none">("any");
  const [placing, setPlacing] = useState(false);
  const walletStatus = useWallet((s) => s.status);
  const balance = useWallet((s) => s.balanceUsdc);
  const connect = useWallet((s) => s.connect);
  const pushToast = useNotifications((s) => s.pushToast);

  const handlePlace = async () => {
    if (walletStatus !== "connected") { await connect(); return; }
    if (!selections.length) return;
    setPlacing(true);
    try {
      if (tab === "singles") {
        if (singleStake <= 0) { pushToast({ kind: "warn", title: "Enter a stake" }); return; }
        const { placed, failures } = await placeSingleBets(selections, singleStake);
        if (placed.length) pushToast({ kind: "success", title: `${placed.length} bet${placed.length > 1 ? "s" : ""} placed` });
        if (failures.length) pushToast({ kind: "error", title: `${failures.length} leg(s) failed`, body: failures[0].error });
        if (placed.length && !failures.length) clearAll();
      } else {
        if (parlayStake <= 0) { pushToast({ kind: "warn", title: "Enter a stake" }); return; }
        const { parlay, failures } = await placeParlay(selections, parlayStake);
        if (parlay) { pushToast({ kind: "success", title: "Parlay placed", body: `${parlay.legs.length} legs @ ${(parlay.combinedOddsX1000 / 1000).toFixed(2)}×` }); clearAll(); }
        else pushToast({ kind: "error", title: "Parlay failed", body: failures[0]?.error ?? "Unknown error" });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Place bet failed", body: (e as Error).message });
    } finally {
      setPlacing(false);
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
    walletConnected: walletStatus === "connected",
    balance,
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
      <aside className="fixed right-0 top-[104px] z-30 hidden h-[calc(100vh-104px-64px)] w-[340px] border-l border-[var(--color-line-1)] bg-[var(--color-bg-1)] lg:block">
        <SlipContent {...shared} />
      </aside>
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
  walletConnected,
  balance,
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
  walletConnected: boolean;
  balance: string;
  onPlace: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3">
        <div className="flex items-center gap-2">
          <TicketIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
          <span className="text-[13px] font-bold tracking-wide">BET SLIP</span>
          {hasSelections && (
            <span className="mono flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--color-bg-3)] px-1.5 text-[11px] font-bold">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasSelections && (
            <button onClick={clearAll} className="text-[12px] text-[var(--color-ink-3)] hover:text-[var(--color-live)]">
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

      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
        {(["singles", "parlay"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === "parlay" && selections.length < 2}
              className={`relative py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "text-white" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              {t === "singles" ? "Singles" : `Multi · ${parlayOdds.toFixed(2)}×`}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-[var(--color-brand-500)]" />}
            </button>
          );
        })}
      </div>

      {/* Selections */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!hasSelections ? (
          <EmptyState />
        ) : (
          <div className="space-y-2 p-3">
            {selections.map((sel) => (
              <SelectionRow
                key={`${sel.matchId}-${sel.market}`}
                sel={sel}
                showStake={tab === "singles"}
                stake={singleStake}
                onStake={(v) => updateStake(sel.matchId, sel.market, v)}
                onRemove={() => removeSelection(sel.matchId, sel.market)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasSelections && (
        <div className="border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
          {tab === "singles" ? (
            <>
              <StakeInput value={singleStake} onChange={setSingleStake} label="Stake per single" />
              <Quick chips={[10, 25, 50, 100]} onPick={(v) => setSingleStake(v)} />
              <Row label="Total stake" value={`${singlesTotalStake.toFixed(2)} USDT`} />
              <Row label="Potential return" value={`${singlesTotalReturn.toFixed(2)} USDT`} accent />
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between rounded-md bg-[var(--color-bg-2)] px-3 py-2">
                <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">Combined odds</span>
                <span className="mono text-base font-bold text-[var(--color-brand-500)]">{parlayOdds.toFixed(2)}×</span>
              </div>
              <StakeInput value={parlayStake} onChange={setParlayStake} label="Stake" />
              <Quick chips={[10, 25, 50, 100]} onPick={(v) => setParlayStake(v)} />
              <Row label="Stake" value={`${parlayStake.toFixed(2)} USDT`} />
              <Row label="Potential return" value={`${parlayReturn.toFixed(2)} USDT`} accent />
            </>
          )}

          <div className="mt-2 mb-3 flex items-center justify-between rounded-md bg-[var(--color-bg-2)] px-2.5 py-1.5">
            <span className="text-[11px] text-[var(--color-ink-3)]">Accept odds changes</span>
            <div className="flex items-center gap-1">
              {(["any", "better", "none"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAccept(a)}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${
                    accept === a ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-3)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onPlace}
            disabled={placing}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] text-[14px] font-black uppercase tracking-wider text-[var(--color-bg-0)] transition-colors hover:bg-[var(--color-brand-400)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ZapIcon className="h-4 w-4" />
            {placing
              ? "Submitting…"
              : !walletConnected
              ? "Connect wallet to bet"
              : tab === "singles"
              ? `Place ${selections.length} bet${selections.length > 1 ? "s" : ""}`
              : "Place parlay"}
          </button>
          <p className="mt-2 text-center text-[10px] text-[var(--color-ink-4)]">
            {walletConnected ? `Balance: ${balance} USDC · ` : ""}On-chain · settled by smart contract · zero gas to you
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-2)]">
        <TicketIcon className="h-6 w-6 text-[var(--color-ink-3)]" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[var(--color-ink-1)]">Your slip is empty</p>
        <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Tap any odds to add a selection</p>
      </div>
    </div>
  );
}

function SelectionRow({
  sel,
  onRemove,
}: {
  sel: Sel;
  showStake: boolean;
  stake: number;
  onStake: (v: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{sel.market}</p>
            <button onClick={onRemove} className="text-[var(--color-ink-3)] hover:text-[var(--color-live)]">
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-bold text-white">{sel.selection}</p>
          <p className="truncate text-[11px] text-[var(--color-ink-3)]">{sel.matchLabel}</p>
        </div>
        <div className="mono shrink-0 text-[13px] font-bold text-[var(--color-brand-500)]">{sel.odds.toFixed(2)}</div>
      </div>
      <button onClick={() => setOpen((v) => !v)} className="mt-1 flex items-center gap-0.5 text-[10px] text-[var(--color-ink-3)] hover:text-white">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Details
      </button>
    </div>
  );
}

function StakeInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <span className="mono text-[10px] text-[var(--color-ink-4)]">Bal 1,250.00</span>
      </div>
      <div className="flex h-10 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-2 focus-within:border-[var(--color-brand-500)]/40">
        <UsdtIcon className="h-4 w-4" />
        <input
          type="number"
          min={0}
          step={0.01}
          inputMode="decimal"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="mono ml-2 w-full bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-[var(--color-ink-4)]"
        />
        <button onClick={() => onChange(1250)} className="ml-2 rounded bg-[var(--color-bg-3)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
          Max
        </button>
      </div>
    </div>
  );
}

function Quick({ chips, onPick }: { chips: number[]; onPick: (n: number) => void }) {
  return (
    <div className="mb-2 grid grid-cols-4 gap-1">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="mono rounded-md bg-[var(--color-bg-2)] py-1.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
        >
          +{c}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-[var(--color-ink-3)]">{label}</span>
      <span className={`mono font-bold ${accent ? "text-[var(--color-brand-500)]" : "text-white"}`}>{value}</span>
    </div>
  );
}
