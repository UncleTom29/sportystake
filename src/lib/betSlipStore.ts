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
  hasSelection: (matchId: string, market: string) => boolean;
};

export const useBetSlip = create<BetSlipStore>((set, get) => ({
  selections: [],
  isOpen: false,
  addSelection: (s) => {
    const exists = get().hasSelection(s.matchId, s.market);
    if (exists) {
      set((state) => ({
        selections: state.selections.filter(
          (sel) => !(sel.matchId === s.matchId && sel.market === s.market)
        ),
      }));
    } else {
      set((state) => ({
        selections: [...state.selections, { ...s, stake: 0 }],
        isOpen: true,
      }));
    }
  },
  removeSelection: (matchId, market) =>
    set((state) => ({
      selections: state.selections.filter(
        (s) => !(s.matchId === matchId && s.market === market)
      ),
    })),
  updateStake: (matchId, market, stake) =>
    set((state) => ({
      selections: state.selections.map((s) =>
        s.matchId === matchId && s.market === market ? { ...s, stake } : s
      ),
    })),
  clearAll: () => set({ selections: [] }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  hasSelection: (matchId, market) =>
    get().selections.some((s) => s.matchId === matchId && s.market === market),
}));
