"use client";

// Lightweight in-memory store for streaming odds updates pushed via SSE.
// Components subscribe by marketId to flash the relevant odds buttons.

import { create } from "zustand";
import type { OddsBundle } from "@/lib/types";

interface OddsTick {
  marketId: string;
  odds?: OddsBundle[];
  // Direction for the most recently changed selection, used for flash colour.
  lastMovement: Record<string, "up" | "down" | "same">;
  at: number;
}

interface LiveOddsState {
  byMarket: Record<string, OddsTick>;
  scores: Record<string, { homeScore?: number; awayScore?: number; minute?: number }>;
  ingest: (marketId: string, odds: OddsBundle[]) => void;
  ingestScore: (marketId: string, payload: { homeScore?: number; awayScore?: number; minute?: number }) => void;
}

export const useLiveOdds = create<LiveOddsState>((set, get) => ({
  byMarket: {},
  scores: {},
  ingest: (marketId, odds) => {
    const prev = get().byMarket[marketId];
    const lastMovement: Record<string, "up" | "down" | "same"> = {};
    for (const bundle of odds) {
      for (const sel of bundle.selections) {
        const key = `${bundle.marketType}:${sel.outcome}`;
        const prevVal = prev?.odds?.find((b) => b.marketType === bundle.marketType)?.selections.find((s) => s.outcome === sel.outcome)?.valueX1000;
        if (prevVal !== undefined) {
          lastMovement[key] = sel.valueX1000 > prevVal ? "up" : sel.valueX1000 < prevVal ? "down" : "same";
        } else if (sel.movement) {
          lastMovement[key] = sel.movement;
        }
      }
    }
    set((s) => ({ byMarket: { ...s.byMarket, [marketId]: { marketId, odds, lastMovement, at: Date.now() } } }));
  },
  ingestScore: (marketId, p) =>
    set((s) => ({ scores: { ...s.scores, [marketId]: { ...s.scores[marketId], ...p } } })),
}));
