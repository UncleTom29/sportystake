import type { CasinoGame } from "@/lib/mockData";
import { FlameIcon, SparkleIcon, TrophyIcon } from "@/components/icons/UIIcons";

export default function GameTile({ game }: { game: CasinoGame }) {
  return (
    <button className="group relative overflow-hidden rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-2)] text-left transition-transform hover:-translate-y-0.5 hover:border-[var(--color-line-2)]">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={{
          background: `radial-gradient(120% 90% at 0% 0%, ${game.accent}33 0%, transparent 55%), linear-gradient(160deg, ${game.color} 0%, ${shade(game.color, -45)} 100%)`,
        }}
      >
        <GameArt name={game.name} accent={game.accent} category={game.category} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

        {/* Top tag */}
        {game.tag && (
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <span
              className={`mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                game.tag === "HOT"
                  ? "bg-[var(--color-live)] text-white"
                  : game.tag === "NEW"
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
                  : "bg-[var(--color-warn)] text-[var(--color-bg-0)]"
              }`}
            >
              {game.tag === "HOT" && <FlameIcon className="h-2.5 w-2.5" />}
              {game.tag === "NEW" && <SparkleIcon className="h-2.5 w-2.5" />}
              {game.tag === "JACKPOT" && <TrophyIcon className="h-2.5 w-2.5" />}
              {game.tag}
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="truncate text-[13px] font-bold text-white">{game.name}</p>
          <p className="truncate text-[10px] text-white/70">{game.provider}</p>
        </div>

        {/* Players online */}
        {game.players && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)] pulse-dot" />
            <span className="mono text-[10px] font-bold text-white">{game.players}</span>
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-black uppercase tracking-wider text-[var(--color-bg-0)]">
            Play
          </span>
        </div>
      </div>
    </button>
  );
}

function GameArt({ name, accent, category }: { name: string; accent: string; category: string }) {
  // Deterministic but unique-looking pattern per game
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  switch (category) {
    case "Crash":
      return (
        <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full">
          <path d="M10 240 Q70 220 110 160 T 190 30" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M10 240 Q70 220 110 160 T 190 30 L 190 260 L 10 260 Z" fill={accent} opacity="0.18" />
          <circle cx="190" cy="30" r="6" fill={accent} />
          <text x="100" y="120" textAnchor="middle" fontFamily="monospace" fontSize="36" fontWeight="900" fill="white" opacity="0.85">
            {(2 + (hash % 60) / 10).toFixed(2)}×
          </text>
        </svg>
      );
    case "Slots":
      return (
        <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full">
          {[0, 1, 2].map((i) => (
            <g key={i} opacity={0.75 - i * 0.15}>
              <rect x={20 + i * 55} y={60} width={45} height={140} rx={6} fill={accent} opacity="0.12" />
              <circle cx={42.5 + i * 55} cy={100 + ((hash + i * 7) % 80)} r={14} fill={accent} />
              <rect x={28 + i * 55} y={150} width={30} height={4} rx={2} fill={accent} opacity="0.4" />
            </g>
          ))}
        </svg>
      );
    case "Dice":
      return (
        <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full">
          <g transform="translate(50,80) rotate(-12)">
            <rect width="60" height="60" rx="10" fill={accent} opacity="0.85" />
            <circle cx="15" cy="15" r="5" fill="white" />
            <circle cx="45" cy="15" r="5" fill="white" />
            <circle cx="15" cy="45" r="5" fill="white" />
            <circle cx="45" cy="45" r="5" fill="white" />
            <circle cx="30" cy="30" r="5" fill="white" />
          </g>
          <g transform="translate(110,130) rotate(15)">
            <rect width="60" height="60" rx="10" fill="white" opacity="0.9" />
            <circle cx="30" cy="30" r="6" fill={accent} />
          </g>
        </svg>
      );
    case "Live":
    case "Table":
      return (
        <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full">
          <ellipse cx="100" cy="150" rx="80" ry="32" fill="black" opacity="0.4" />
          <ellipse cx="100" cy="142" rx="76" ry="28" fill={accent} opacity="0.5" />
          <ellipse cx="100" cy="138" rx="72" ry="24" fill={accent} opacity="0.8" />
          <g>
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x={40 + i * 16} y={110 - (i % 2) * 6} width="10" height="14" rx="2" fill="white" opacity={0.75 - (i % 3) * 0.15} />
            ))}
          </g>
        </svg>
      );
    case "Original":
      return (
        <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full">
          <g>
            {Array.from({ length: 36 }).map((_, i) => {
              const row = Math.floor(i / 9);
              const col = i % 9;
              return (
                <circle
                  key={i}
                  cx={20 + col * 20 + (row % 2 ? 10 : 0)}
                  cy={50 + row * 28}
                  r={3.5}
                  fill={accent}
                  opacity={0.25 + ((hash + i) % 7) * 0.08}
                />
              );
            })}
          </g>
          <circle cx="100" cy="200" r="8" fill="white" />
        </svg>
      );
    default:
      return null;
  }
}

function shade(hex: string, percent: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const adj = (v: number) => Math.round((t - v) * p + v);
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}
