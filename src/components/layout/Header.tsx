"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBetSlip } from "@/lib/betSlipStore";
import { LogoMark, SearchIcon, TicketIcon, GiftIcon } from "@/components/icons/UIIcons";
import WalletButton from "@/components/integration/WalletButton";
import NotificationBell from "@/components/integration/NotificationBell";
import SearchModal from "@/components/integration/SearchModal";

export default function Header() {
  const { selections, toggle } = useBetSlip();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="hidden text-[15px] font-black tracking-tight text-white sm:block">
            sporty<span className="text-[var(--color-brand-500)]">stake</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <SegLink href="/sportsbook" label="Sports" />
          <SegLink href="/casino" label="Casino" />
          <SegLink href="/pools" label="Pools" />
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:max-w-md md:flex-none lg:ml-4 lg:max-w-lg lg:flex-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)] md:hidden"
            aria-label="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="relative hidden w-full md:block"
            aria-label="Search"
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <span className="flex h-9 w-full items-center rounded-md border border-transparent bg-[var(--color-bg-2)] pl-9 pr-3 text-left text-sm text-[var(--color-ink-3)] hover:bg-[var(--color-bg-3)]">
              Search teams, leagues, games…
              <kbd className="mono ml-auto rounded border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <button
            onClick={toggle}
            className="relative flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-bg-2)] px-2.5 text-sm font-medium text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)] hover:text-white lg:hidden"
            aria-label="Bet slip"
          >
            <TicketIcon className="h-4 w-4" />
            <span className="hidden md:inline">Bet slip</span>
            {selections.length > 0 && (
              <span className="absolute -right-1 -top-1 mono flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand-500)] px-1 text-[10px] font-black text-[var(--color-bg-0)]">
                {selections.length}
              </span>
            )}
          </button>

          <Link
            href="/leaderboard"
            aria-label="Leaderboard"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white md:flex"
          >
            <GiftIcon className="h-4 w-4" />
          </Link>

          <NotificationBell />
          <WalletButton />
        </div>
      </div>
    </header>
    <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function SegLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-9 items-center rounded-md px-3 text-[13px] font-semibold text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-white"
    >
      {label}
    </Link>
  );
}
