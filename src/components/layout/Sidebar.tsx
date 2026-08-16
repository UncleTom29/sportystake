"use client";

import { useState } from "react";
import { SportIcon } from "@/components/icons/SportIcons";
import { ChevronDown, ChevronRight, FlameIcon, StarIcon, CloseIcon } from "@/components/icons/UIIcons";

type SectionKey = "popular" | "sports" | "leagues";
export type PopularFilter = "hot" | "favourites";

type SidebarSport = {
  slug: Parameters<typeof SportIcon>[0]["sport"];
  name: string;
  count: number;
};

type SidebarLeague = {
  id: number;
  name: string;
  sport: Parameters<typeof SportIcon>[0]["sport"];
  country: string;
  live: number;
  total: number;
};

export default function Sidebar({
  sports,
  leagues,
  popularCounts,
  activeSport,
  activeLeagueId,
  activePopular,
  onSportChange,
  onLeagueChange,
  onPopularChange,
  mobileOpen,
  onMobileClose,
}: {
  sports: SidebarSport[];
  leagues: SidebarLeague[];
  popularCounts: Record<PopularFilter, number>;
  activeSport?: string;
  activeLeagueId?: number;
  activePopular?: PopularFilter | null;
  onSportChange?: (slug: string) => void;
  onLeagueChange?: (leagueId: number, sport: string) => void;
  onPopularChange?: (key: PopularFilter) => void;
  /** Controls the below-lg drawer — see the "Filters" trigger in
   *  SportsbookPageInner. Below `lg` the `<aside>` is hidden entirely, so
   *  without this, league filtering and Popular/Favourites are completely
   *  unreachable on mobile and tablet. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    popular: true,
    sports: true,
    leagues: true,
  });

  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const sections = (
    <>
      <Section title="Popular" open={open.popular} onToggle={() => toggle("popular")}>
        <Item
          Icon={FlameIcon}
          label="Upcoming"
          right={String(popularCounts.hot)}
          active={activePopular === "hot"}
          onClick={() => onPopularChange?.("hot")}
        />
        <Item
          Icon={StarIcon}
          label="Favourites"
          right={String(popularCounts.favourites)}
          active={activePopular === "favourites"}
          onClick={() => onPopularChange?.("favourites")}
        />
      </Section>

      <Section title="Sports" open={open.sports} onToggle={() => toggle("sports")}>
        {sports.map((s) => (
          <SportItem
            key={s.slug}
            slug={s.slug}
            name={s.name}
            count={s.count}
            active={activeSport === s.slug}
            onClick={() => onSportChange?.(s.slug)}
          />
        ))}
      </Section>

      <Section title="Top leagues" open={open.leagues} onToggle={() => toggle("leagues")}>
        {leagues.map((l) => (
          <LeagueItem
            key={l.id}
            name={l.name}
            sport={l.sport}
            country={l.country}
            live={l.live}
            total={l.total}
            active={activeLeagueId === l.id}
            onClick={() => onLeagueChange?.(l.id, l.sport)}
          />
        ))}
      </Section>
    </>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-[112px] max-h-[calc(100vh-120px)] space-y-1 overflow-y-auto pb-6 pr-2 scrollbar-thin">
          {sections}
        </div>
      </aside>

      {/* Mobile / tablet drawer — same Popular/Sports/Leagues content the
          desktop aside shows, reachable via the "Filters" button below lg. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div onClick={onMobileClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3">
              <span className="text-[13px] font-bold tracking-wide text-white">FILTERS</span>
              <button
                onClick={onMobileClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)]"
                aria-label="Close filters"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 p-2 pb-6">{sections}</div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-4)] hover:text-white"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="space-y-px py-0.5">{children}</div>}
    </div>
  );
}

function Item({
  Icon,
  label,
  right,
  highlight,
  active,
  onClick,
}: {
  Icon: (p: { className?: string }) => React.ReactElement;
  label: string;
  right?: string;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] ${
        active ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-2)]"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={`h-4 w-4 ${highlight ? "text-[var(--color-live)]" : "text-[var(--color-ink-3)]"}`} />
        <span>{label}</span>
      </span>
      {right && (
        <span className={`mono text-[11px] ${highlight ? "text-[var(--color-live)]" : "text-[var(--color-ink-4)]"}`}>
          {right}
        </span>
      )}
    </button>
  );
}

function SportItem({
  slug,
  name,
  count,
  active,
  onClick,
}: {
  slug: Parameters<typeof SportIcon>[0]["sport"];
  name: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] ${
        active ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-2)]"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <SportIcon sport={slug} className={`h-4 w-4 ${active ? "text-[var(--color-brand-500)]" : "text-[var(--color-ink-3)]"}`} />
        <span>{name}</span>
      </span>
      <span className="mono text-[11px] text-[var(--color-ink-4)]">{count}</span>
    </button>
  );
}

function LeagueItem({
  name,
  sport,
  country,
  live,
  total,
  active,
  onClick,
}: {
  name: string;
  sport: Parameters<typeof SportIcon>[0]["sport"];
  country: string;
  live: number;
  total: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] ${
        active ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-2)]"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <SportIcon sport={sport} className={`h-4 w-4 ${active ? "text-[var(--color-brand-500)]" : "text-[var(--color-ink-3)]"}`} />
        <span className="truncate">{name}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="mono rounded bg-[var(--color-bg-2)] px-1 py-0.5 text-[9px] font-bold text-[var(--color-ink-4)]">
          {country}
        </span>
        {live > 0 && (
          <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
            <span className="h-1 w-1 rounded-full bg-[var(--color-live)] pulse-dot" />
            {live}
          </span>
        )}
        <span className="mono text-[10px] text-[var(--color-ink-4)]">{total}</span>
      </span>
    </button>
  );
}
