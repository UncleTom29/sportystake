"use client";

import { create } from "zustand";
import type { QuotaMode } from "@/lib/types";

interface QuotaState {
  mode: QuotaMode;
  used: number;
  remaining: number;
  resetAt: string;
  setStatus: (s: { mode: QuotaMode; used: number; remaining: number; resetAt: string }) => void;
}

export const useQuotaStore = create<QuotaState>((set) => ({
  mode: "normal",
  used: 0,
  remaining: 100,
  resetAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
  setStatus: (s) => set(s),
}));
