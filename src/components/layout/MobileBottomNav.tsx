"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBetSlip } from "@/lib/betSlipStore";
import { useWallet } from "@/lib/walletStore";
import {
  HomeIcon,
  TrophyIcon,
  CasinoChipIcon,
  TicketIcon,
  WalletIcon,
  DotsHorizontalIcon,
  CloseIcon,
  ZapIcon,
  GiftIcon,
} from "@/components/icons/UIIcons";

const mainItems = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/sportsbook", label: "Sports", Icon: TrophyIcon, base: "/sportsbook" },
  { href: "/casino", label: "Casino", Icon: CasinoChipIcon },
  { href: "/prediction-markets", label: "Predictions", Icon: ZapIcon },
];

const moreNavItems = [
  { href: "/live", label: "🔴 Live Scores", desc: "Real-time match updates" },
  { href: "/leaderboard", label: "🏆 Leaderboard & Referrals", desc: "Rankings & prize pools" },
  { href: "/social", label: "👥 Social Bet Feed", desc: "Tail top tipster tickets" },
  { href: "/ai-analytics", label: "🎯 AI Picks & Predictions", desc: "Smart AI match insights" },
  { href: "/prediction-markets", label: "🔮 Prediction Markets", desc: "Speculate on global outcomes" },
  { href: "/account", label: "💼 Wallet & Account", desc: "Profile, bets & referrals" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { toggle, selections } = useBetSlip();
  const user = useWallet((s) => s.user);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)]/95 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6 items-center">
          {mainItems.map(({ href, label, Icon, base }) => {
            const test = base ?? href.split("?")[0];
            const active = test === "/" ? pathname === "/" : pathname.startsWith(test);
            return (
              <Link
                key={label}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
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
              <span className="mono absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-brand-500)] px-1 text-[9px] font-black text-[var(--color-bg-0)]">
                {selections.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              moreOpen ? "text-[var(--color-brand-500)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            <DotsHorizontalIcon className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Slide-up Drawer for More Menu */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <div className="relative z-10 rounded-t-2xl border-t border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-line-1)] pb-3">
              <div className="flex items-center gap-2">
                <ZapIcon className="h-4 w-4 text-[var(--color-brand-500)]" />
                <h3 className="text-sm font-bold text-white">More Features & Navigation</h3>
              </div>
              <button onClick={() => setMoreOpen(false)} className="text-[var(--color-ink-3)] hover:text-white p-1">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2">
              {moreNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3 hover:border-[var(--color-line-2)] hover:bg-[var(--color-bg-3)] transition-all"
                >
                  <div>
                    <p className="text-[13px] font-bold text-white">{item.label}</p>
                    <p className="text-[11px] text-[var(--color-ink-3)]">{item.desc}</p>
                  </div>
                  <span className="text-[var(--color-ink-3)] text-xs">→</span>
                </Link>
              ))}

              {Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "OPERATOR")) && (
                <Link
                  href="/admin"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10 p-3 hover:bg-[var(--color-brand-500)]/20 transition-all"
                >
                  <div>
                    <p className="text-[13px] font-bold text-[var(--color-brand-500)]">Admin Portal 🛡️</p>
                    <p className="text-[11px] text-[var(--color-ink-3)]">Risk, liquidity & market controls</p>
                  </div>
                  <span className="text-[var(--color-brand-500)] text-xs">→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
