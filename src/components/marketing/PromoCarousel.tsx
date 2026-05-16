"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { promos } from "@/lib/mockData";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "@/components/icons/UIIcons";

export default function PromoCarousel() {
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setIdx((i) => (i + 1) % promos.length), 6500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
      <div className="bg-grid absolute inset-0 opacity-30" />
      <div className="bg-mesh absolute inset-0" />
      <div
        className="relative flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {promos.map((p) => (
          <div
            key={p.id}
            className="relative grid w-full shrink-0 grid-cols-1 items-center gap-4 p-6 md:grid-cols-[1.5fr_1fr] md:p-8"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${p.gradient}`} />
            <div className="relative">
              <span
                className="mono inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${p.accent}22`, color: p.accent }}
              >
                {p.tag}
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">{p.title}</h2>
              <p className="mt-2 max-w-md text-[13px] text-[var(--color-ink-2)] md:text-sm">{p.subtitle}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={p.href}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-4 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
                >
                  {p.cta}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <button className="inline-flex h-10 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)]/60 px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]">
                  Learn more
                </button>
              </div>
            </div>

            <div className="relative hidden md:block">
              <PromoArt accent={p.accent} />
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <button
        onClick={() => setIdx((i) => (i - 1 + promos.length) % promos.length)}
        className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 md:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => setIdx((i) => (i + 1) % promos.length)}
        className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 md:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {promos.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}

function PromoArt({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 320 200" className="h-44 w-full">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.9" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="g2" cx="50%" cy="50%">
          <stop offset="0" stopColor={accent} stopOpacity="0.45" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="200" fill="url(#g2)" />
      <g stroke={accent} strokeOpacity="0.4" strokeWidth="1" fill="none">
        <circle cx="240" cy="100" r="80" />
        <circle cx="240" cy="100" r="60" />
        <circle cx="240" cy="100" r="40" strokeOpacity="0.7" />
        <circle cx="240" cy="100" r="20" strokeOpacity="0.9" />
      </g>
      <g fill={accent}>
        <rect x="40" y="120" width="6" height="40" rx="2" />
        <rect x="56" y="100" width="6" height="60" rx="2" />
        <rect x="72" y="80" width="6" height="80" rx="2" />
        <rect x="88" y="60" width="6" height="100" rx="2" />
        <rect x="104" y="40" width="6" height="120" rx="2" />
        <rect x="120" y="70" width="6" height="90" rx="2" />
        <rect x="136" y="90" width="6" height="70" rx="2" />
      </g>
      <path
        d="M40 150 L80 110 L130 140 L180 70 L240 100 L300 50"
        stroke={accent}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M40 150 L80 110 L130 140 L180 70 L240 100 L300 50 L300 200 L40 200 Z" fill="url(#g1)" opacity="0.35" />
    </svg>
  );
}
