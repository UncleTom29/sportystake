"use client";
import { useMemo, useState } from "react";
import { casinoGames } from "@/lib/mockData";
import GameTile from "@/components/casino/GameTile";
import SectionHeader from "@/components/ui/SectionHeader";
import {
  SearchIcon,
  FlameIcon,
  SparkleIcon,
  TrophyIcon,
  CasinoChipIcon,
  ZapIcon,
  ArrowUpRight,
} from "@/components/icons/UIIcons";

type Cat = "All" | "Originals" | "Slots" | "Live" | "Table" | "Crash" | "Dice";

const cats: { id: Cat; label: string; Icon?: (p: { className?: string }) => React.ReactElement }[] = [
  { id: "All", label: "All" },
  { id: "Originals", label: "Originals", Icon: SparkleIcon },
  { id: "Slots", label: "Slots", Icon: FlameIcon },
  { id: "Live", label: "Live", Icon: ZapIcon },
  { id: "Table", label: "Table", Icon: TrophyIcon },
  { id: "Crash", label: "Crash" },
  { id: "Dice", label: "Dice" },
];

export default function CasinoPage() {
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return casinoGames.filter((g) => {
      if (cat !== "All") {
        if (cat === "Originals") {
          if (g.category !== "Original" && g.provider !== "SportyStake") return false;
        } else if (g.category !== cat) return false;
      }
      if (q && !g.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, q]);

  const hot = casinoGames.filter((g) => g.tag === "HOT").slice(0, 6);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Featured hero — Crash */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 100% 0%, rgba(167, 139, 250, 0.35) 0%, transparent 50%), radial-gradient(80% 80% at 0% 100%, rgba(0, 231, 1, 0.18) 0%, transparent 55%)",
          }}
        />
        <div className="relative grid items-center gap-4 p-5 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <span className="mono inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              <SparkleIcon className="h-3 w-3" /> Featured · Original
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Crash Rocket</h1>
            <p className="mt-2 max-w-md text-[13px] text-[var(--color-ink-2)] md:text-sm">
              Watch the multiplier climb. Cash out before it busts. 100% provably fair —
              every round verified by an on-chain VRF seed.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 max-w-md">
              <div>
                <p className="mono text-2xl font-black text-violet-300">2.48×</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Last bust</p>
              </div>
              <div>
                <p className="mono text-2xl font-black text-[var(--color-brand-500)]">2,204</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Players</p>
              </div>
              <div>
                <p className="mono text-2xl font-black text-white">97.00%</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">RTP</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button className="inline-flex h-11 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-5 text-[14px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
                Play now
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button className="inline-flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]">
                View results
              </button>
            </div>
          </div>

          {/* Live crash chart */}
          <div className="relative h-44 md:h-56">
            <CrashChart />
          </div>
        </div>
      </div>

      {/* Search + categories */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 200+ games…"
            className="h-10 w-full rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-2)] pl-9 pr-3 text-sm text-white placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-500)]/40 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${
                cat === c.id
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                  : "bg-[var(--color-bg-2)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
              }`}
            >
              {c.Icon && <c.Icon className="h-3.5 w-3.5" />}
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-1.5 text-[11px] text-[var(--color-ink-3)] md:flex">
          <CasinoChipIcon className="h-3.5 w-3.5" />
          247 games online
        </div>
      </div>

      {/* Hot row */}
      {q === "" && cat === "All" && (
        <section className="mt-6">
          <SectionHeader title="Trending now" subtitle="Most played in the last hour" Icon={FlameIcon} accent="#ff8a00" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
            {hot.map((g) => (
              <GameTile key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      {/* All games */}
      <section className="mt-6">
        <SectionHeader
          title={cat === "All" ? "All games" : cat}
          subtitle={`${filtered.length} available`}
          Icon={CasinoChipIcon}
          accent="#a78bfa"
        />
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          {filtered.map((g) => (
            <GameTile key={g.id} game={g} />
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-[11px] text-[var(--color-ink-4)]">
        18+ only · Gamble responsibly · Self-exclusion & deposit limits available in account settings
      </p>
    </div>
  );
}

function CrashChart() {
  const points: [number, number][] = [];
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const y = Math.exp(x * 2.4) - 1;
    points.push([x * 320, 200 - (y / (Math.exp(2.4) - 1)) * 180]);
  }
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.45" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="320" y2={i * 40} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="200" />
        ))}
      </g>
      <path d={`${path} L320,200 L0,200 Z`} fill="url(#crashFill)" />
      <path d={path} stroke="#a78bfa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx={320} cy={20} r="5" fill="#a78bfa" />
      <text x="40" y="60" fill="white" fontFamily="monospace" fontSize="48" fontWeight="900">
        2.48
        <tspan fontSize="32" fill="#a78bfa">×</tspan>
      </text>
    </svg>
  );
}
