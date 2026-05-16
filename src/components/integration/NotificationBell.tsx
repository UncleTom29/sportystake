"use client";

import { useState } from "react";
import { useNotifications } from "@/lib/notificationStore";
import { BellIcon } from "@/components/icons/UIIcons";

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const KIND_ICON: Record<string, string> = {
  bet_won: "🏆",
  bet_lost: "📉",
  bet_confirmed: "🎟",
  lp_settled: "💰",
  quota: "⚠️",
  system: "🛰",
};

export default function NotificationBell() {
  const items = useNotifications((s) => s.notifications);
  const markAll = useNotifications((s) => s.markAllRead);
  const unread = items.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAll(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
        aria-label="Notifications"
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-[var(--color-brand-500)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-2)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--color-line-1)] p-3">
            <p className="text-[12px] font-bold text-white">Notifications</p>
            <button onClick={markAll} className="text-[10px] text-[var(--color-ink-3)] hover:text-white">Mark all read</button>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12px] text-[var(--color-ink-3)]">No notifications yet</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className="border-b border-[var(--color-line-1)] px-3 py-2.5 last:border-0">
                  <div className="flex items-start gap-2">
                    <span aria-hidden>{KIND_ICON[n.kind] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-white">{n.message}</p>
                      <p className="mono mt-0.5 text-[10px] text-[var(--color-ink-3)]">{timeAgo(n.at)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)]" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
