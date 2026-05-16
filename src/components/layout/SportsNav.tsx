"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SportIcon } from "@/components/icons/SportIcons";
import { LiveIcon, FlameIcon, TrophyIcon, SparkleIcon, CasinoChipIcon, GiftIcon } from "@/components/icons/UIIcons";
import { sportsList } from "@/lib/mockData";

const primary = [
  { href: "/sportsbook?tab=live", label: "Live", Icon: LiveIcon, hot: true },
  { href: "/sportsbook?tab=popular", label: "Popular", Icon: FlameIcon },
  { href: "/sportsbook", label: "Sports", Icon: TrophyIcon },
  { href: "/esports", label: "Esports", Icon: SparkleIcon },
  { href: "/casino", label: "Casino", Icon: CasinoChipIcon },
  { href: "/ai-analytics", label: "AI Picks", Icon: SparkleIcon },
  { href: "/social", label: "Social", Icon: GiftIcon },
  { href: "/fantasy", label: "Fantasy", Icon: TrophyIcon },
  { href: "/pools", label: "Pools", Icon: SparkleIcon },
];

export default function SportsNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-14 z-40 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 scrollbar-none md:px-5">
        {primary.map(({ href, label, Icon, hot }) => {
          const base = href.split("?")[0];
          const active = pathname === base || (base !== "/" && pathname.startsWith(base));
          return (
            <Link
              key={label}
              href={href}
              className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--color-bg-3)] text-white"
                  : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${hot ? "text-[var(--color-live)]" : active ? "text-[var(--color-brand-500)]" : ""}`}
              />
              <span>{label}</span>
              {hot && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-live)] pulse-dot" />}
            </Link>
          );
        })}
        <div className="mx-2 h-5 w-px shrink-0 bg-[var(--color-line-2)]" />
        {sportsList.slice(0, 9).map((s) => {
          const active = pathname.startsWith(`/sportsbook/${s.slug}`);
          return (
            <Link
              key={s.slug}
              href={`/sportsbook?sport=${s.slug}`}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors ${
                active
                  ? "bg-[var(--color-bg-3)] text-white"
                  : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
              }`}
            >
              <SportIcon sport={s.slug} className="h-4 w-4 text-[var(--color-ink-3)]" />
              <span>{s.name}</span>
              <span className="mono text-[10px] text-[var(--color-ink-4)]">{s.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
