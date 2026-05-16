"use client";
import { useState } from "react";
import { sportsList, topLeagues } from "@/lib/mockData";
import { SportIcon } from "@/components/icons/SportIcons";
import { ChevronDown, ChevronRight, FlameIcon, StarIcon, LiveIcon } from "@/components/icons/UIIcons";

type SectionKey = "popular" | "sports" | "leagues";

export default function Sidebar({
  activeSport,
  onSportChange,
}: {
  activeSport?: string;
  onSportChange?: (slug: string) => void;
}) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    popular: true,
    sports: true,
    leagues: true,
  });

  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-[112px] max-h-[calc(100vh-120px)] space-y-1 overflow-y-auto pb-6 pr-2 scrollbar-thin">
        <Section title="Popular" open={open.popular} onToggle={() => toggle("popular")}>
          <Item Icon={LiveIcon} label="Live now" right="248" highlight />
          <Item Icon={FlameIcon} label="Hot bets" right="32" />
          <Item Icon={StarIcon} label="Favourites" right="0" />
        </Section>

        <Section title="Sports" open={open.sports} onToggle={() => toggle("sports")}>
          {sportsList.map((s) => (
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
          {topLeagues.map((l) => (
            <LeagueItem key={l.slug} {...l} />
          ))}
        </Section>
      </div>
    </aside>
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
}: {
  Icon: (p: { className?: string }) => React.ReactElement;
  label: string;
  right?: string;
  highlight?: boolean;
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-2)]">
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
}: {
  name: string;
  sport: Parameters<typeof SportIcon>[0]["sport"];
  country: string;
  live: number;
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-2)]">
      <span className="flex items-center gap-2.5">
        <SportIcon sport={sport} className="h-4 w-4 text-[var(--color-ink-3)]" />
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
      </span>
    </button>
  );
}
