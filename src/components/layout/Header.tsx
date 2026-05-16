"use client";
import Link from "next/link";
import { useState } from "react";
import { useBetSlip } from "@/lib/betSlipStore";
import { LogoMark, SearchIcon, BellIcon, WalletIcon, TicketIcon, GiftIcon, ChevronDown, UsdtIcon } from "@/components/icons/UIIcons";

export default function Header() {
  const { selections, toggle } = useBetSlip();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="hidden text-[15px] font-black tracking-tight text-white sm:block">
            sporty<span className="text-[var(--color-brand-500)]">stake</span>
          </span>
        </Link>

        {/* Casino / Sports tabs (Stake-style) */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <SegLink href="/sportsbook" label="Sports" active />
          <SegLink href="/casino" label="Casino" />
        </nav>

        {/* Search */}
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:max-w-md md:flex-none lg:ml-4 lg:max-w-lg lg:flex-1">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:bg-[var(--color-bg-3)] md:hidden"
            aria-label="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          <div className="relative hidden w-full md:block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <input
              type="text"
              placeholder="Search teams, leagues, games…"
              className="h-9 w-full rounded-md border border-transparent bg-[var(--color-bg-2)] pl-9 pr-3 text-sm text-white placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-500)]/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Right group */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {/* Wallet balance pill */}
          <div className="hidden items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] pl-3 sm:flex">
            <div className="flex items-center gap-1.5">
              <UsdtIcon className="h-4 w-4" />
              <span className="mono text-sm font-semibold text-white">1,250.00</span>
            </div>
            <button className="ml-1 flex items-center gap-1 rounded-md px-2 text-[var(--color-ink-2)] hover:text-white">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button className="h-9 rounded-r-md bg-[var(--color-brand-500)] px-3.5 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
              Deposit
            </button>
          </div>

          {/* Bet slip */}
          <button
            onClick={toggle}
            className="relative flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-bg-2)] px-2.5 text-sm font-medium text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)] hover:text-white lg:hidden"
          >
            <TicketIcon className="h-4 w-4" />
            <span className="hidden md:inline">Bet slip</span>
            {selections.length > 0 && (
              <span className="absolute -right-1 -top-1 mono flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand-500)] px-1 text-[10px] font-black text-[var(--color-bg-0)]">
                {selections.length}
              </span>
            )}
          </button>

          {/* Promo */}
          <button className="hidden h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white md:flex">
            <GiftIcon className="h-4 w-4" />
          </button>

          {/* Notifications */}
          <button className="relative hidden h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white md:flex">
            <BellIcon className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-brand-500)]" />
          </button>

          <button className="hidden h-9 rounded-md bg-[var(--color-bg-3)] px-3 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-4)] md:block">
            Sign in
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-3 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]">
            <WalletIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Connect</span>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-2 md:hidden">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <input
              autoFocus
              type="text"
              placeholder="Search teams, leagues, games…"
              className="h-10 w-full rounded-md border border-transparent bg-[var(--color-bg-2)] pl-9 pr-3 text-sm text-white placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-500)]/40 focus:outline-none"
            />
          </div>
        </div>
      )}
    </header>
  );
}

function SegLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex h-9 items-center rounded-md px-3 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-[var(--color-bg-3)] text-white"
          : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
