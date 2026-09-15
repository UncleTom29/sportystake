"use client";

import { useState, useRef, useCallback } from "react";
import { useWallet } from "@/lib/walletStore";
import { useNotifications } from "@/lib/notificationStore";
import { CloseIcon } from "@/components/icons/UIIcons";
import { Upload, Camera, Trash2, Check, Sparkles, Image as ImageIcon } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

const BADGE_PRESETS = [
  { id: "crown", label: "Champion", icon: "👑" },
  { id: "trophy", label: "Winner", icon: "🏆" },
  { id: "zap", label: "Volt", icon: "⚡" },
  { id: "fire", label: "Hotstreak", icon: "🔥" },
  { id: "diamond", label: "High Roller", icon: "💎" },
  { id: "bullseye", label: "Sharpshooter", icon: "🎯" },
  { id: "soccer", label: "Striker", icon: "⚽" },
  { id: "basketball", label: "Hooper", icon: "🏀" },
  { id: "boxing", label: "Fighter", icon: "🥊" },
  { id: "racing", label: "Speedster", icon: "🏎️" },
  { id: "lion", label: "Apex Lion", icon: "🦁" },
  { id: "eagle", label: "Falcon", icon: "🦅" },
];

function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Please select an image file (PNG, JPG, WEBP, or GIF)."));
    }
    if (file.size > 10 * 1024 * 1024) {
      return reject(new Error("Image is too large. Max size is 10MB."));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Failed to process image"));

          // Calculate center-cropped square
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          // Try WebP first, fallback to JPEG
          let dataUrl = canvas.toDataURL("image/webp", 0.88);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to decode image file."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

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
  const [selected, setSelected] = useState<string>(currentAvatar || "");
  const [tab, setTab] = useState<"upload" | "badges">(
    currentAvatar && currentAvatar.startsWith("data:") ? "upload" : "upload"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pushToast = useNotifications((s) => s.pushToast);

  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      try {
        const dataUrl = await processImageFile(file);
        setSelected(dataUrl);
        setTab("upload");
        pushToast({ kind: "info", title: "Image Loaded", body: "Preview ready. Click Save Avatar to apply." });
      } catch (err) {
        pushToast({ kind: "error", title: "Upload Failed", body: (err as Error).message });
      } finally {
        setProcessing(false);
      }
    },
    [pushToast]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

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
      useWallet.getState().updateAvatar(selected);
      pushToast({ kind: "success", title: "Avatar Updated", body: "Your profile avatar has been saved." });
      onAvatarSaved(selected);
      onClose();
    } catch (e) {
      pushToast({ kind: "error", title: "Update Failed", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const isUploadedImage = selected && (selected.startsWith("data:") || selected.startsWith("http"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--color-ink-3)] hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Profile Avatar</h3>
            <p className="text-[12px] text-[var(--color-ink-3)]">
              Upload a custom photo or choose a sports badge
            </p>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="my-5 flex flex-col items-center justify-center rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5">
          <div className="relative group">
            <UserAvatar
              avatar={selected}
              size={88}
              className="ring-4 ring-[var(--color-brand-500)]/30 border-2 border-[var(--color-line-2)] shadow-xl"
            />
            {isUploadedImage && (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-[10px] font-bold text-[var(--color-bg-0)] shadow">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
            Active Preview
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mb-4 grid grid-cols-2 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-1">
          <button
            onClick={() => setTab("upload")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-bold transition-all ${
              tab === "upload"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow"
                : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Photo</span>
          </button>
          <button
            onClick={() => setTab("badges")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-bold transition-all ${
              tab === "badges"
                ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow"
                : "text-[var(--color-ink-3)] hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Sports Badges</span>
          </button>
        </div>

        {/* Tab 1: Upload Dropzone */}
        {tab === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileInputChange}
              className="hidden"
            />

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10"
                  : "border-[var(--color-line-2)] bg-[var(--color-bg-2)]/60 hover:border-[var(--color-brand-500)]/50 hover:bg-[var(--color-bg-2)]"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg-3)] text-[var(--color-brand-500)] ring-1 ring-[var(--color-line-1)] mb-2.5">
                {processing ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </div>
              <p className="text-[13px] font-bold text-white">
                {processing ? "Processing image…" : "Click to browse or drag & drop"}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                PNG, JPG, WEBP or GIF (automatically centered &amp; cropped)
              </p>
            </div>

            {isUploadedImage && (
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-2)] px-3 py-2 border border-[var(--color-line-1)]">
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Custom photo selected
                </span>
                <button
                  onClick={() => {
                    setSelected("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-live)] hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Curated Sports Badges */}
        {tab === "badges" && (
          <div className="grid grid-cols-4 gap-2.5 max-h-[190px] overflow-y-auto p-1 scrollbar-thin">
            {BADGE_PRESETS.map((b) => {
              const active = selected === b.icon;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.icon)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition-all ${
                    active
                      ? "bg-[var(--color-brand-500)]/20 ring-2 ring-[var(--color-brand-500)] scale-105"
                      : "bg-[var(--color-bg-2)] hover:bg-[var(--color-bg-3)] border border-[var(--color-line-1)]"
                  }`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-[10px] font-bold text-[var(--color-ink-2)] truncate max-w-full">
                    {b.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--color-line-1)] pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-[var(--color-bg-2)] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || processing}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-500)] px-5 py-2.5 text-[12px] font-black uppercase tracking-wider text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:opacity-50 shadow-lg shadow-[var(--color-brand-500)]/20"
          >
            {saving ? "Saving…" : "Save Avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}

