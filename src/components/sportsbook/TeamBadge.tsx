export default function TeamBadge({
  initials,
  color,
  size = "md",
}: {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-[14px]" : "h-8 w-8 text-[11px]";
  // Generate a darker shade for the bg using rgba on the color
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full font-black text-white ${dim}`}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${shade(color, -25)} 100%)`,
        boxShadow: `inset 0 -1px 0 ${shade(color, -40)}, 0 0 0 1px rgba(255,255,255,0.06)`,
      }}
    >
      <span className="relative">{initials}</span>
    </div>
  );
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
