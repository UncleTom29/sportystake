"use client";
import Link from "next/link";
import { useWallet } from "@/lib/walletStore";
import { TrophyIcon, ZapIcon, ShieldIcon, TrendUp, SparkleIcon, CopyIcon, BadgeCheck, ChevronRight } from "@/components/icons/UIIcons";

const MOCK_STATS = {
  totalBets: 47,
  won: 27,
  lost: 18,
  cancelled: 2,
  winRate: 60.0,
  streak: 4,
  bestStreak: 9,
  totalWagered: 2450.0,
  netPnl: 312.8,
  lpPositions: 2,
  lpEarned: 48.2,
};

const ACTIVITY = [
  { id: "a1", type: "bet_won", label: "Chelsea vs Liverpool · Draw", amount: "+52.80", time: "2h ago", color: "var(--color-brand-500)" },
  { id: "a2", type: "lp_deposit", label: "Liquidity added — Arsenal vs Man City", amount: "-500.00", time: "6h ago", color: "var(--color-info)" },
  { id: "a3", type: "bet_lost", label: "Bayern vs Dortmund · Bayern Win", amount: "-25.00", time: "1d ago", color: "var(--color-live)" },
  { id: "a4", type: "bet_won", label: "Crash game · 3.24×", amount: "+97.20", time: "1d ago", color: "var(--color-brand-500)" },
  { id: "a5", type: "lp_settled", label: "LP settled — UCL match", amount: "+12.40", time: "2d ago", color: "var(--color-brand-500)" },
  { id: "a6", type: "bet_lost", label: "Lakers vs Celtics · Lakers ML", amount: "-50.00", time: "3d ago", color: "var(--color-live)" },
];

const TYPE_ICON: Record<string, string> = {
  bet_won: "🏆", bet_lost: "📉", lp_deposit: "💧", lp_settled: "💰", bet_placed: "🎟",
};

export default function AccountPage() {
  const address = useWallet((s) => s.address) ?? "0x4a...91bc";
  const connect = useWallet((s) => s.connect);
  const status = useWallet((s) => s.status);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  const winRate = MOCK_STATS.winRate;
  const winRateColor = winRate >= 60 ? "var(--color-brand-500)" : winRate >= 50 ? "var(--color-warn)" : "var(--color-live)";

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Profile header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,231,1,0.07),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-3)] text-2xl font-black border-2 border-[var(--color-line-2)]">
            🎯
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-white">CryptoStaker</h1>
              <BadgeCheck className="h-4 w-4 text-[var(--color-info)]" />
              {MOCK_STATS.streak >= 3 && (
                <span className="mono flex items-center gap-1 rounded bg-[var(--color-warn)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--color-warn)]">
                  🔥 {MOCK_STATS.streak} streak
                </span>
              )}
            </div>
            <button onClick={copyAddress} className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)] hover:text-white">
              <span className="mono">{address}</span>
              <CopyIcon className="h-3.5 w-3.5" />
            </button>
            <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Member since Jan 2025 · Arc Network</p>
          </div>
          {status !== "connected" && (
            <button onClick={connect} className="shrink-0 rounded-md bg-[var(--color-brand-500)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-0)]">
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total bets" value={String(MOCK_STATS.totalBets)} Icon={TrophyIcon} accent="var(--color-warn)" />
        <StatCard label="Win rate" value={`${winRate}%`} Icon={BadgeCheck} accent={winRateColor} />
        <StatCard label="Current streak" value={`${MOCK_STATS.streak} 🔥`} Icon={ZapIcon} accent="var(--color-warn)" />
        <StatCard label="Best streak" value={String(MOCK_STATS.bestStreak)} Icon={SparkleIcon} accent="#a78bfa" />
        <StatCard label="Total wagered" value={`$${MOCK_STATS.totalWagered.toLocaleString()}`} Icon={ShieldIcon} accent="var(--color-info)" />
        <StatCard
          label="Net P&L"
          value={`${MOCK_STATS.netPnl >= 0 ? "+" : ""}$${MOCK_STATS.netPnl.toFixed(2)}`}
          Icon={TrendUp}
          accent={MOCK_STATS.netPnl >= 0 ? "var(--color-brand-500)" : "var(--color-live)"}
        />
        <StatCard label="LP positions" value={String(MOCK_STATS.lpPositions)} Icon={SparkleIcon} accent="var(--color-brand-500)" />
        <StatCard label="LP earned" value={`+$${MOCK_STATS.lpEarned}`} Icon={TrendUp} accent="var(--color-brand-500)" />
      </div>

      {/* Quick links */}
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <QuickLink href="/account/bets" label="My Bets" sub={`${MOCK_STATS.totalBets} total · ${MOCK_STATS.won} won`} icon="🎟" />
        <QuickLink href="/account/wallet" label="Wallet" sub="1,247.50 USDC balance" icon="💼" />
        <QuickLink href="/pools" label="LP Positions" sub={`${MOCK_STATS.lpPositions} active · +$${MOCK_STATS.lpEarned} earned`} icon="💧" />
      </div>

      {/* Activity chart placeholder */}
      <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">30-day activity</p>
        <ActivityChart />
      </div>

      {/* Recent activity */}
      <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Recent activity</p>
          <Link href="/account/bets" className="text-[12px] text-[var(--color-brand-500)] hover:underline">View all →</Link>
        </div>
        {ACTIVITY.map((a) => (
          <div key={a.id} className="flex items-center gap-3 border-b border-[var(--color-line-1)] px-4 py-3 text-[13px] last:border-0 hover:bg-[var(--color-bg-3)]">
            <span className="text-xl">{TYPE_ICON[a.type] ?? "📋"}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold text-white">{a.label}</p>
              <p className="text-[11px] text-[var(--color-ink-3)]">{a.time}</p>
            </div>
            <span className="mono font-bold" style={{ color: a.color }}>{a.amount} USDC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, accent }: {
  label: string; value: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${accent}20`, color: accent }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mono text-xl font-black" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function QuickLink({ href, label, sub, icon }: { href: string; label: string; sub: string; icon: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 hover:border-[var(--color-line-2)] hover:bg-[var(--color-bg-3)] transition-colors">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white">{label}</p>
        <p className="text-[11px] text-[var(--color-ink-3)] truncate">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[var(--color-ink-3)]" />
    </Link>
  );
}

function ActivityChart() {
  const data = Array.from({ length: 30 }, (_, i) => ({
    vol: Math.random() * 200 + 20,
    pnl: (Math.random() - 0.4) * 80,
  }));
  const maxVol = Math.max(...data.map((d) => d.vol));
  const W = 600, H = 80;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * W;
        const barH = (d.vol / maxVol) * H;
        const isPos = d.pnl >= 0;
        return (
          <rect
            key={i}
            x={x - 7}
            y={H - barH}
            width={14}
            height={barH}
            rx={3}
            fill={isPos ? "rgba(0,231,1,0.3)" : "rgba(255,45,45,0.3)"}
          />
        );
      })}
      <text x={0} y={H + 16} fontSize={10} fill="var(--color-ink-4)">30 days ago</text>
      <text x={W} y={H + 16} fontSize={10} fill="var(--color-ink-4)" textAnchor="end">Today</text>
    </svg>
  );
}
