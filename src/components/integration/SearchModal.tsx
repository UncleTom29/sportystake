"use client";

import { useEffect, useState } from "react";
import { Markets } from "@/lib/api-client";
import type { MarketDTO } from "@/lib/types";
import { SearchIcon } from "@/components/icons/UIIcons";

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MarketDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("ss_search_recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore */ }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await Markets.search(q.trim());
        if (!cancelled) setItems(r.items);
      } catch { if (!cancelled) setItems([]); }
      finally { if (!cancelled) setLoading(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  if (!open) return null;

  const remember = (text: string) => {
    const next = [text, ...recent.filter((x) => x !== text)].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem("ss_search_recent", JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-line-1)] px-4 py-3">
          <SearchIcon className="h-4 w-4 text-[var(--color-ink-3)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams, leagues, matches…"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[var(--color-ink-3)] focus:outline-none"
          />
          <kbd className="mono rounded border border-[var(--color-line-1)] bg-[var(--color-bg-3)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-2)]">esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {loading && <p className="px-4 py-6 text-center text-[12px] text-[var(--color-ink-3)]">Searching…</p>}
          {!loading && q && items.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-[var(--color-ink-3)]">No matches for &quot;{q}&quot;</p>
          )}
          {!loading && items.map((m) => (
            <a
              key={m.id}
              href={`/sportsbook/match/${m.id}`}
              onClick={() => remember(q.trim())}
              className="flex items-center gap-3 border-b border-[var(--color-line-1)] px-4 py-2.5 hover:bg-[var(--color-bg-3)]"
            >
              <span className="text-[10px] uppercase text-[var(--color-ink-3)]">{m.leagueName}</span>
              <span className="text-[13px] font-semibold text-white">{m.homeTeam} vs {m.awayTeam}</span>
              <span className="mono ml-auto text-[11px] text-[var(--color-ink-3)]">{new Date(m.startTime).toLocaleString()}</span>
            </a>
          ))}
          {!q && recent.length > 0 && (
            <div className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((r) => (
                  <button key={r} onClick={() => setQ(r)} className="rounded border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-2 py-1 text-[11px] text-white hover:bg-[var(--color-bg-3)]">{r}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
