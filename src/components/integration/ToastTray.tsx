"use client";

import { useNotifications } from "@/lib/notificationStore";

export default function ToastTray() {
  const toasts = useNotifications((s) => s.toasts);
  const remove = useNotifications((s) => s.removeToast);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto overflow-hidden rounded-lg border bg-[var(--color-bg-2)] shadow-lg ${
            t.kind === "success"
              ? "border-[var(--color-brand-500)]/40"
              : t.kind === "warn"
              ? "border-[var(--color-warn)]/40"
              : t.kind === "error"
              ? "border-[var(--color-live)]/40"
              : "border-[var(--color-line-2)]"
          }`}
          style={{ animation: "ss-toast-in 0.18s ease-out" }}
        >
          <div className="flex items-start gap-2 p-3">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                t.kind === "success" ? "bg-[var(--color-brand-500)]" :
                t.kind === "warn" ? "bg-[var(--color-warn)]" :
                t.kind === "error" ? "bg-[var(--color-live)]" :
                "bg-[var(--color-info)]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[11px] text-[var(--color-ink-3)]">{t.body}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-[var(--color-ink-3)] hover:text-white"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <style jsx global>{`
        @keyframes ss-toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
