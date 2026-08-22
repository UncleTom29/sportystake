"use client";

import { useState } from "react";
import { useNotifications } from "@/lib/notificationStore";
import { CloseIcon, TrophyIcon } from "@/components/icons/UIIcons";

const AVATAR_PRESETS = [
  "🎯", "⚡", "👑", "🔥", "🏆", "💎",
  "🚀", "🦁", "🐉", "🎲", "🦈", "🦅",
  "⚽", "🏀", "🎾", "🥊", "🏎️", "🌟",
];

export default function AvatarSelectorModal({
  open,
  onClose,
  currentAvatar,
  onAvatarSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onAvatarSaved: (avatar: string) => void;
}) {
  const [selected, setSelected] = useState(currentAvatar || "🎯");
  const [saving, setSaving] = useState(false);
  const pushToast = useNotifications((s) => s.pushToast);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: selected }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "Failed to update avatar");
      }
      pushToast({ kind: "success", title: "Avatar Updated", body: `Changed avatar to ${selected}` });
      onAvatarSaved(selected);
      onClose();
    } catch (e) {
      pushToast({ kind: "error", title: "Update Failed", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-[var(--color-ink-3)] hover:text-white">
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <TrophyIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Select User Avatar</h3>
            <p className="text-[12px] text-[var(--color-ink-3)]">Choose an icon to represent your profile on leaderboards and feeds</p>
          </div>
        </div>

        {/* Selected preview */}
        <div className="my-5 flex flex-col items-center justify-center rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-3)] text-3xl shadow-inner border-2 border-[var(--color-brand-500)]">
            {selected}
          </div>
          <span className="mt-2 text-[11px] font-bold text-[var(--color-ink-3)]">Active Selection</span>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_PRESETS.map((icon) => (
            <button
              key={icon}
              onClick={() => setSelected(icon)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition-all ${
                selected === icon
                  ? "bg-[var(--color-brand-500)]/20 ring-2 ring-[var(--color-brand-500)] scale-110"
                  : "bg-[var(--color-bg-2)] hover:bg-[var(--color-bg-3)]"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-[var(--color-bg-2)] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[var(--color-brand-500)] px-5 py-2.5 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}
