"use client";
import Link from "next/link";
import { matches } from "@/lib/mockData";

const liveMatches = matches.filter((m) => m.isLive);

export default function LiveScoreTicker() {
  if (liveMatches.length === 0) return null;

  const items = liveMatches.flatMap((m) => [
    `🔴 ${m.homeTeam} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeam} ${m.liveMinute ?? ""}`,
    m.league,
  ]);

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="relative h-8 overflow-hidden border-b border-[var(--color-line-1)] bg-[var(--color-live)]/5">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center bg-[var(--color-live)] px-3">
        <span className="mono text-[10px] font-black uppercase tracking-wider text-white">Live</span>
      </div>
      <div className="absolute inset-y-0 left-16 right-0 overflow-hidden">
        <div
          className="flex h-full items-center gap-8 whitespace-nowrap text-[12px] text-[var(--color-ink-1)]"
          style={{
            animation: "ticker 30s linear infinite",
          }}
        >
          {doubled.map((item, i) => (
            <span key={i} className={i % 2 === 0 ? "font-semibold text-white" : "text-[var(--color-ink-3)]"}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
