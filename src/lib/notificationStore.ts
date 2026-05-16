"use client";

import { create } from "zustand";
import { shortId } from "@/lib/uid";

export interface ToastEntry {
  id: string;
  kind: "info" | "success" | "warn" | "error";
  title: string;
  body?: string;
  at: number;
  ttl: number; // ms
}

export interface NotificationEntry {
  id: string;
  kind: "bet_won" | "bet_lost" | "bet_confirmed" | "lp_settled" | "quota" | "system";
  message: string;
  at: number;
  read: boolean;
}

interface NotificationStore {
  toasts: ToastEntry[];
  notifications: NotificationEntry[];
  pushToast: (t: Omit<ToastEntry, "id" | "at" | "ttl"> & { ttl?: number }) => void;
  removeToast: (id: string) => void;
  pushNotification: (n: Omit<NotificationEntry, "id" | "at" | "read">) => void;
  markAllRead: () => void;
  unreadCount: () => number;
}

export const useNotifications = create<NotificationStore>((set, get) => ({
  toasts: [],
  notifications: [],
  pushToast: (t) => {
    const entry: ToastEntry = { id: `t-${shortId()}`, at: Date.now(), ttl: t.ttl ?? 3500, ...t };
    set((s) => ({ toasts: [...s.toasts, entry].slice(-6) }));
    setTimeout(() => get().removeToast(entry.id), entry.ttl);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  pushNotification: (n) => set((s) => ({
    notifications: [{ id: `n-${shortId()}`, at: Date.now(), read: false, ...n }, ...s.notifications].slice(0, 50),
  })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
