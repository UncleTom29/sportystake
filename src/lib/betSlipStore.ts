"use client";
import { create } from "zustand";

export type BetSelection = {
  matchId: string;
  matchLabel: string;
  market: string;
  selection: string;
  odds: number;
  stake: number;
};

type BetSlipStore = {
  selections: BetSelection[];
  isOpen: boolean;
  addSelection: (s: Omit<BetSelection, "stake">) => void;
  removeSelection: (matchId: string, market: string) => void;
  updateStake: (matchId: string, market: string, stake: number) => void;
  clearAll: () => void;
  toggle: () => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
  loadSelections: (selections: BetSelection[]) => void;
  appendSelections: (selections: BetSelection[]) => void;
  /** Pass `selection` to check a specific outcome; omit to check any outcome in the market. */
  hasSelection: (matchId: string, market: string, selection?: string) => boolean;
};

// Debounced save to avoid hammering the server
let saveTimeout: NodeJS.Timeout;

export const useBetSlip = create<BetSlipStore>((set, get) => ({
  selections: [],
  isOpen: false,
  
  loadFromServer: async () => {
    try {
      const res = await fetch("/api/betslip");
      const { selections } = await res.json();
      set({ selections: selections || [] });
    } catch {
      // Fail silently if server sync fails
    }
  },
  
  saveToServer: async () => {
    try {
      await fetch("/api/betslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: get().selections }),
      });
    } catch {
      // Fail silently
    }
  },
  
  addSelection: (s) => {
    const existing = get().selections.find(
      (sel) => sel.matchId === s.matchId && sel.market === s.market
    );
    if (existing) {
      if (existing.selection === s.selection) {
        // Same outcome clicked again → toggle off
        set((state) => ({
          selections: state.selections.filter(
            (sel) => !(sel.matchId === s.matchId && sel.market === s.market)
          ),
        }));
      } else {
        // Different outcome in same market → replace, preserve stake
        set((state) => ({
          selections: state.selections.map((sel) =>
            sel.matchId === s.matchId && sel.market === s.market
              ? { ...s, stake: sel.stake }
              : sel
          ),
        }));
      }
    } else {
      // Adding a selection only updates the slip's badge count — it must
      // not force the slip open. On mobile the slip is a full-screen
      // drawer (see BetSlipRail.tsx), so auto-opening it on every odds tap
      // would block the screen the user is trying to browse. Opening is
      // reserved for an explicit tap on the Slip button (MobileBottomNav /
      // Header) via `toggle()`.
      set((state) => ({
        selections: [...state.selections, { ...s, stake: 0 }],
      }));
    }

    // Debounce save
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },
  
  removeSelection: (matchId, market) => {
    set((state) => ({
      selections: state.selections.filter(
        (s) => !(s.matchId === matchId && s.market === market)
      ),
    }));
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },
  
  updateStake: (matchId, market, stake) => {
    set((state) => ({
      selections: state.selections.map((s) =>
        s.matchId === matchId && s.market === market ? { ...s, stake } : s
      ),
    }));
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },
  
  clearAll: () => {
    set({ selections: [] });
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },
  
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  
  loadSelections: (selections) => {
    set({
      selections: selections.map((s) => ({ ...s, stake: s.stake || 0 })),
      isOpen: true,
    });
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },

  appendSelections: (newSelections) => {
    const current = get().selections;
    const merged = [...current];
    for (const ns of newSelections) {
      const idx = merged.findIndex(
        (sel) => sel.matchId === ns.matchId && sel.market === ns.market
      );
      if (idx >= 0) {
        merged[idx] = { ...ns, stake: merged[idx].stake || ns.stake || 0 };
      } else {
        merged.push({ ...ns, stake: ns.stake || 0 });
      }
    }
    set({ selections: merged, isOpen: true });
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToServer();
    }, 500);
  },
  
  hasSelection: (matchId, market, selection) =>
    get().selections.some(
      (s) =>
        s.matchId === matchId &&
        s.market === market &&
        (selection === undefined || s.selection === selection)
    ),
}));
