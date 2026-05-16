"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBetSlip } from "@/lib/betSlipStore";
import { HomeIcon, LiveIcon, CasinoChipIcon, TicketIcon, WalletIcon } from "@/components/icons/UIIcons";

const items = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/sportsbook?tab=live", label: "Live", Icon: LiveIcon, base: "/sportsbook" },
  { href: "/casino", label: "Casino", Icon: CasinoChipIcon },
  { href: "/pools", label: "Pools", Icon: WalletIcon },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { toggle, selections } = useBetSlip();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, Icon, base }) => {
          const test = base ?? href.split("?")[0];
          const active = test === "/" ? pathname === "/" : pathname.startsWith(test);
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-[var(--color-brand-500)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={toggle}
          className="relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-[var(--color-ink-2)]"
        >
          <TicketIcon className="h-5 w-5" />
          <span>Slip</span>
          {selections.length > 0 && (
            <span className="mono absolute right-3 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-brand-500)] px-1 text-[9px] font-black text-[var(--color-bg-0)]">
              {selections.length}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
