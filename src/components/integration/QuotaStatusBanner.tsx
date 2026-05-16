"use client";

import { useQuotaStore } from "@/lib/quotaStore";

export default function QuotaStatusBanner() {
  const mode = useQuotaStore((s) => s.mode);
  const remaining = useQuotaStore((s) => s.remaining);
  if (mode === "normal") return null;
  const isEmergency = mode === "emergency";
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold ${
        isEmergency
          ? "bg-[var(--color-live)]/15 text-[var(--color-live)]"
          : "bg-[var(--color-warn)]/15 text-[var(--color-warn)]"
      }`}
      role="status"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isEmergency ? "bg-[var(--color-live)] pulse-dot" : "bg-[var(--color-warn)]"}`} />
      <span className="uppercase tracking-wider">
        {isEmergency ? "Data limit reached" : "Data refresh rate reduced"}
      </span>
      <span className="text-[10px] font-normal opacity-80">
        {isEmergency
          ? "Showing last known odds until midnight UTC."
          : `Conservation mode — ${remaining} API requests remain today.`}
      </span>
    </div>
  );
}
