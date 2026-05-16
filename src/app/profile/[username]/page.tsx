"use client";
import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, BadgeCheck, TrophyIcon, ZapIcon, HeartIcon, ChevronRight } from "@/components/icons/UIIcons";

const PROFILE_DATA = {
  handle: "CryptoTipster.eth",
  address: "0x4a2f…91bc",
  joined: "January 2025",
  verified: true,
  followers: 4820,
  following: 312,
  isPublic: true,
  stats: {
    totalBets: 284,
    winRate: 67.2,
    roi: 22.4,
    streak: 8,
    bestStreak: 15,
    totalWagered: 42500,
    netPnl: 9425,
  },
  badges: [
    { id: "hot", emoji: "🔥", label: "Hot Streak" },
    { id: "highroller", emoji: "💰", label: "High Roller" },
    { id: "value", emoji: "🎯", label: "Value Bettor" },
    { id: "early", emoji: "⭐", label: "Early Adopter" },
  ],
  recentBets: [
    { id: "rb1", match: "Arsenal vs Man City", selection: "Arsenal Win", odds: 2.85, amount: 200, status: "WON", payout: 570, time: "2h ago" },
    { id: "rb2", match: "Real Madrid vs Barça", selection: "Over 2.5", odds: 1.72, amount: 150, status: "WON", payout: 258, time: "1d ago" },
    { id: "rb3", match: "Bayern vs Dortmund", selection: "Bayern Win", odds: 1.65, amount: 300, status: "LOST", payout: 0, time: "2d ago" },
    { id: "rb4", match: "Chelsea vs Liverpool", selection: "Draw", odds: 3.20, amount: 100, status: "WON", payout: 320, time: "3d ago" },
    { id: "rb5", match: "3-leg parlay", selection: "Accumulator", odds: 12.4, amount: 50, status: "WON", payout: 620, time: "4d ago" },
  ],
};

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [following, setFollowing] = useState(false);
  const profile = { ...PROFILE_DATA, handle: decodeURIComponent(username) || PROFILE_DATA.handle };

  const winRateColor = profile.stats.winRate >= 60 ? "var(--color-brand-500)" : "var(--color-warn)";

  return (
    <div className="mx-auto max-w-[900px] px-3 py-4 md:px-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/social" className="flex items-center gap-1 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          Social
        </Link>
        <span>/</span>
        <span className="text-white">@{profile.handle}</span>
      </div>

      {/* Profile hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.1),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start">
          {/* Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#f59e0b] bg-[#f59e0b]/10 text-3xl font-black">
            🏆
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">@{profile.handle}</h1>
              {profile.verified && <BadgeCheck className="h-5 w-5 text-[var(--color-info)]" />}
            </div>
            <p className="mono mt-0.5 text-[12px] text-[var(--color-ink-3)]">{profile.address}</p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">Member since {profile.joined}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.badges.map((b) => (
                <span key={b.id} className="flex items-center gap-1 rounded-md bg-[var(--color-bg-3)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink-1)]">
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => setFollowing((f) => !f)}
              className={`h-9 rounded-md px-4 text-[13px] font-bold transition-colors ${
                following
                  ? "border border-[var(--color-line-2)] bg-[var(--color-bg-3)] text-[var(--color-ink-1)]"
                  : "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
            <div className="flex items-center gap-3 text-center text-[12px]">
              <div>
                <p className="mono font-black text-white">{profile.followers.toLocaleString()}</p>
                <p className="text-[var(--color-ink-3)]">followers</p>
              </div>
              <div>
                <p className="mono font-black text-white">{profile.following.toLocaleString()}</p>
                <p className="text-[var(--color-ink-3)]">following</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total bets" value={String(profile.stats.totalBets)} Icon={TrophyIcon} accent="var(--color-warn)" />
        <StatCard label="Win rate" value={`${profile.stats.winRate}%`} Icon={BadgeCheck} accent={winRateColor} />
        <StatCard label="ROI" value={`+${profile.stats.roi}%`} Icon={ZapIcon} accent="var(--color-brand-500)" />
        <StatCard label="Hot streak" value={`${profile.stats.streak} 🔥`} Icon={HeartIcon} accent="var(--color-warn)" />
      </div>

      {/* Public bets */}
      {profile.isPublic ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Recent public bets</p>
          </div>
          {profile.recentBets.map((bet) => {
            const won = bet.status === "WON";
            return (
              <div key={bet.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4" style={{ borderLeftColor: won ? "var(--color-brand-500)" : "var(--color-live)", borderLeftWidth: 3 }}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-[13px]">{bet.match}</p>
                  <p className="text-[12px] text-[var(--color-ink-2)]">
                    {bet.selection} @ <span className="mono font-bold text-[var(--color-warn)]">{bet.odds.toFixed(2)}</span>
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-3)]">{bet.time}</p>
                </div>
                <div className="text-right">
                  <p className="mono text-[14px] font-bold" style={{ color: won ? "var(--color-brand-500)" : "var(--color-live)" }}>
                    {won ? `+$${(bet.payout - bet.amount).toFixed(0)}` : `-$${bet.amount}`}
                  </p>
                  <p className="text-[10px] text-[var(--color-ink-3)]">${bet.amount} staked</p>
                </div>
                <button className="ml-2 flex h-8 items-center gap-1 rounded-md bg-[var(--color-bg-3)] px-2.5 text-[11px] font-bold text-[var(--color-ink-1)] hover:bg-[var(--color-bg-4)]">
                  Copy <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] py-16 text-center">
          <p className="text-[15px] font-bold text-[var(--color-ink-2)]">This profile is private</p>
          <p className="text-[12px] text-[var(--color-ink-3)]">Follow to see their bets</p>
        </div>
      )}
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
