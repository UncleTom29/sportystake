"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBetSlip } from "@/lib/betSlipStore";

const navItems = [
  { label: "Sportsbook", href: "/sportsbook", icon: "⚽" },
  { label: "Casino", href: "/casino", icon: "🎰" },
  { label: "Esports", href: "/esports", icon: "🎮" },
  { label: "Fantasy", href: "/fantasy", icon: "🏆" },
  { label: "Social", href: "/social", icon: "👥" },
  { label: "AI Picks", href: "/ai-analytics", icon: "🤖" },
  { label: "Pools", href: "/pools", icon: "💧" },
];

export default function Header() {
  const pathname = usePathname();
  const { selections, toggle } = useBetSlip();

  return (
    <header className="sticky top-0 z-50 bg-[#0d1821]/95 backdrop-blur border-b border-white/5">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-black text-black text-sm">
            SS
          </div>
          <span className="font-black text-white text-lg tracking-tight hidden sm:block">
            Sporty<span className="text-green-400">Stake</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-1 mx-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-[#1a2738] border border-white/10 rounded-xl px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="text-green-400 font-bold text-sm">1,250.00</span>
            <span className="text-gray-500 text-xs">USDT</span>
          </div>

          <button
            onClick={toggle}
            className="relative flex items-center gap-1.5 bg-[#1a2738] border border-white/10 hover:border-green-500/50 rounded-xl px-3 py-1.5 text-sm text-white transition-colors"
          >
            <span>🎟️</span>
            <span className="font-medium">Bet Slip</span>
            {selections.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 text-black text-xs font-black flex items-center justify-center">
                {selections.length}
              </span>
            )}
          </button>

          <button className="bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-4 py-1.5 rounded-xl transition-colors">
            Connect
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
