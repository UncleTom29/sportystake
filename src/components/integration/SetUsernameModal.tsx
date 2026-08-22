"use client";

import { useState, useEffect } from "react";
import { UserApi } from "@/lib/api-client";
import { useNotifications } from "@/lib/notificationStore";
import { CloseIcon } from "@/components/icons/UIIcons";
import { AtSign, CheckCircle2, AlertCircle } from "lucide-react";

export default function SetUsernameModal({
  open,
  onClose,
  onUsernameSet,
}: {
  open: boolean;
  onClose: () => void;
  onUsernameSet: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useNotifications((s) => s.pushToast);

  // Real-time debounced availability check
  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setAvailable(null);
      setReason(null);
      return;
    }

    setChecking(true);
    const timer = setTimeout(() => {
      UserApi.checkUsername(username)
        .then((res) => {
          setAvailable(res.available);
          setReason(res.reason ?? null);
        })
        .catch(() => {
          setAvailable(false);
          setReason("Error checking availability");
        })
        .finally(() => setChecking(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!available || submitting) return;

    setSubmitting(true);
    try {
      const res = await UserApi.setUsername(username);
      pushToast({
        kind: "success",
        title: "Username Claimed",
        body: `@${res.user.username} is now associated with your account`,
      });
      onUsernameSet(res.user.username!);
      onClose();
    } catch (err) {
      pushToast({ kind: "error", title: "Claim Failed", body: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--color-ink-3)] hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
            <AtSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Choose Username</h3>
            <p className="text-[12px] text-[var(--color-ink-3)]">
              Set your unique @handle for leaderboards and tipster slips
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
              Username
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 mono text-sm font-bold text-[var(--color-ink-3)]">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="cryptotrader"
                maxLength={20}
                className="mono h-11 w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-0)] pl-8 pr-10 text-[14px] font-bold text-white outline-none focus:border-[var(--color-brand-500)]"
              />
              {checking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent" />
              )}
            </div>

            {/* Validation helper message */}
            {available === true && (
              <p className="mt-1.5 text-[11px] font-bold text-[var(--color-brand-500)] flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> @{username} is available!
              </p>
            )}
            {available === false && reason && (
              <p className="mt-1.5 text-[11px] font-bold text-[var(--color-live)] flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {reason}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[var(--color-bg-2)] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[var(--color-bg-3)]"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={!available || submitting}
              className="rounded-xl bg-[var(--color-brand-500)] px-5 py-2.5 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] disabled:opacity-40"
            >
              {submitting ? "Claiming…" : "Save Username"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
