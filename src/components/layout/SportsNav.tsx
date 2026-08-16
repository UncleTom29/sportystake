"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Markets } from "@/lib/api-client";
import { SportIcon } from "@/components/icons/SportIcons";
import { FlameIcon, TrophyIcon, ZapIcon, TicketIcon } from "@/components/icons/UIIcons";
import { sportsList } from "@/lib/mockData";

const primary = [
  { href: "/sportsbook?featured=1&popular=hot", label: "Popular", Icon: FlameIcon },
  { href: "/prediction-markets", label: "Prediction Markets", Icon: ZapIcon },
  { href: "/social", label: "Social", Icon: TicketIcon },
  { href: "/ai-analytics", label: "AI Picks", Icon: ZapIcon },
];

export default function SportsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSport = searchParams.get("sport") ?? "all";
  const [sportCounts, setSportCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    Markets.sports()
      .then((res) => {
        if (cancelled) return;
        setSportCounts(new Map(res.items.map((item) => [item.sport, item.total])));
      })
      .catch(() => {
        if (!cancelled) setSportCounts(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

const MAJOR_SPORTS_ORDER = [
  "football",
  "basketball",
  "tennis",
  "american-football",
  "baseball",
  "ice-hockey",
  "mma",
  "boxing",
  "esports",
  "volleyball",
  "table-tennis",
  "rugby",
  "cricket",
];

function getSportPriority(slug: string): number {
  const norm = slug.toLowerCase();
  const idx = MAJOR_SPORTS_ORDER.indexOf(norm);
  return idx !== -1 ? idx : 99;
}

  const quickSports = useMemo(() => {
    const bySlug = new Map(sportsList.map((s) => [s.slug, s]));
    const nonZero = Array.from(sportCounts.entries())
      .filter(([slug, count]) => count > 0 && slug !== "prediction-markets")
      .map(([slug, count]) => ({
        slug,
        name: bySlug.get(slug as typeof sportsList[number]["slug"])?.name ?? slug,
        count,
      }))
      .sort((a, b) => {
        const pa = getSportPriority(a.slug);
        const pb = getSportPriority(b.slug);
        if (pa !== pb) return pa - pb;
        return b.count - a.count;
      });

    if (nonZero.length > 0) return nonZero;

    return sportsList
      .filter((s) => (s.slug as string) !== "prediction-markets")
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        count: sportCounts.get(s.slug) ?? 0,
      }))
      .sort((a, b) => {
        const pa = getSportPriority(a.slug);
        const pb = getSportPriority(b.slug);
        if (pa !== pb) return pa - pb;
        return b.count - a.count;
      });
  }, [sportCounts]);

  const isLive = pathname === "/live";

  return (
    <div className="sticky top-14 z-40 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 scrollbar-none md:px-5">
        {!isLive && primary.map(({ href, label, Icon }) => {
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
              <Icon className={`h-4 w-4 ${active ? "text-[var(--color-brand-500)]" : ""}`} />
              <span>{label}</span>
            </Link>
          );
        })}
        {!isLive && <div className="mx-2 h-5 w-px shrink-0 bg-[var(--color-line-2)]" />}
        {quickSports.map((s) => {
          const active = pathname === "/sportsbook" && activeSport === s.slug;
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
              <SportIcon sport={s.slug as typeof sportsList[number]["slug"]} className="h-4 w-4 text-[var(--color-ink-3)]" />
              <span>{s.name}</span>
              <span className="mono text-[10px] text-[var(--color-ink-4)]">{s.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
