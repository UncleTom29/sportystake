"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletStore";
import { usePrivyLogin } from "@/lib/usePrivyLogin";
import { useUsdcBalance } from "@/lib/useWalletBalance";
import { Bets } from "@/lib/api-client";
import { useNotifications } from "@/lib/notificationStore";
import type { UserStats, BetDTO } from "@/lib/types";
import {
  TrophyIcon,
  ZapIcon,
  ShieldIcon,
  TrendUp,
  CopyIcon,
  BadgeCheck,
  ChevronRight,
  GiftIcon,
} from "@/components/icons/UIIcons";
import {
  Trophy,
  TrendingDown,
  Droplets,
  Coins,
  Ticket,
  FileText,
  Pencil,
  Flame,
  Wallet,
  Zap,
  User,
} from "lucide-react";
import SetUsernameModal from "@/components/integration/SetUsernameModal";
import AvatarSelectorModal from "@/components/integration/AvatarSelectorModal";
import WelcomeBonusControl from "@/components/profile/WelcomeBonusControl";

function ActivityTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "bet_won":
      return <Trophy className="h-4 w-4 text-[var(--color-brand-500)]" />;
    case "bet_lost":
      return <TrendingDown className="h-4 w-4 text-[var(--color-live)]" />;
    case "lp_deposit":
      return <Droplets className="h-4 w-4 text-cyan-400" />;
    case "lp_settled":
      return <Coins className="h-4 w-4 text-amber-400" />;
    case "bet_placed":
    default:
      return <Ticket className="h-4 w-4 text-[var(--color-warn)]" />;
  }
}

function betToActivity(b: BetDTO) {
  const won = b.status === "WON" || b.status === "CLAIMED";
  const lost = b.status === "LOST";
  return {
    id: b.id,
    type: won ? "bet_won" : lost ? "bet_lost" : "bet_placed",
    label: `${b.marketLabel} · ${b.selectionLabel}`,
    amount: won ? `+${b.potentialPayout}` : `-${b.amount}`,
    time: b.settledAt
      ? new Date(b.settledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    color: won ? "var(--color-brand-500)" : lost ? "var(--color-live)" : "var(--color-warn)",
  };
}

export default function AccountPage() {
  const walletAddress = useWallet((s) => s.address);
  const isConnected = useWallet((s) => s.authStatus === "authenticated");
  const { signIn } = usePrivyLogin();
  const { balanceFormatted } = useUsdcBalance({ address: walletAddress ?? undefined });
  const pushToast = useNotifications((s) => s.pushToast);

  const [userMe, setUserMe] = useState<{ id: string; username?: string; avatar?: string; referralCode?: string } | null>(null);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [bets, setBets] = useState<BetDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const displayAddress = walletAddress ?? "0x…";

  const fetchUserData = () => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.user) {
          setUserMe(data.data.user);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      return;
    }

    fetchUserData();

    Promise.all([
      Bets.myStats().catch(() => null),
      Bets.my({ limit: 90 }).catch(() => null),
    ])
      .then(([s, res]) => {
        if (s) setStats(s);
        if (res) setBets(res.items);
      })
      .finally(() => setLoading(false));
  }, [isConnected]);

  const activity = useMemo(() => bets.slice(0, 6).map(betToActivity), [bets]);

  const copyAddress = () => {
    navigator.clipboard.writeText(displayAddress);
    pushToast({ kind: "info", title: "Address Copied", body: displayAddress });
  };

  const referralCode = userMe?.username || userMe?.referralCode || displayAddress;
  const refLink = `https://sportystake.com/?ref=${referralCode}`;
  const profileLink = `https://sportystake.com/social?user=${userMe?.username || displayAddress}`;

  const copyRefLink = () => {
    navigator.clipboard.writeText(refLink);
    pushToast({ kind: "success", title: "Referral Link Copied", body: refLink });
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileLink);
    pushToast({ kind: "success", title: "Profile Link Copied", body: profileLink });
  };

  const winRate = stats?.winRate ?? 0;
  const winRateColor =
    winRate >= 60 ? "var(--color-brand-500)" : winRate >= 50 ? "var(--color-warn)" : "var(--color-live)";
  const streak = stats?.currentStreak ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-4">
      <div className="min-w-0">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,231,1,0.07),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start">
          <div
            onClick={() => setAvatarModalOpen(true)}
            title="Click to change avatar"
            className="relative group flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg-3)] text-2xl font-black border-2 border-[var(--color-line-2)] hover:border-[var(--color-brand-500)] transition-all"
          >
            {userMe?.avatar || <User className="h-8 w-8 text-[var(--color-ink-2)]" />}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-[10px] font-bold text-[var(--color-bg-0)] shadow">
              <Pencil className="h-3 w-3" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {userMe?.username ? (
                <div className="flex items-center gap-2">
                  <h1 className="mono text-xl font-black text-[var(--color-brand-500)]">
                    @{userMe.username}
                  </h1>
                  <button
                    onClick={() => setUsernameModalOpen(true)}
                    className="rounded bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-3)] hover:text-white"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-white">
                    {isConnected ? `${displayAddress.slice(0, 6)}…${displayAddress.slice(-4)}` : "Not connected"}
                  </h1>
                  {isConnected && (
                    <button
                      onClick={() => setUsernameModalOpen(true)}
                      className="rounded-lg bg-[var(--color-brand-500)] px-3 py-1 text-[11px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] shadow"
                    >
                      + Set Unique Username
                    </button>
                  )}
                </div>
              )}
              {isConnected && <BadgeCheck className="h-4 w-4 text-[var(--color-info)] shrink-0" />}
              {streak >= 3 && (
                <span
                  className="mono flex items-center gap-1 rounded bg-[var(--color-warn)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--color-warn)]"
                  title="Consecutive wins across your most recent bets and parlays"
                >
                  <Flame className="h-3.5 w-3.5" />
                  {streak} streak
                </span>
              )}
            </div>

            {isConnected && (
              <button
                onClick={copyAddress}
                className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)] hover:text-white"
              >
                <span className="mono">{displayAddress}</span>
                <CopyIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">Arc Network · Non-Custodial USDC Wallet</p>
          </div>

          {!isConnected && (
            <button
              onClick={() => void signIn()}
              className="shrink-0 rounded-lg bg-[var(--color-brand-500)] px-5 py-2.5 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] shadow-lg"
            >
              Sign in with Google / Wallet
            </button>
          )}
        </div>
      </div>

      {/* Welcome Bonus Engine Control Card */}
      {isConnected && (
        <div className="mt-4">
          <WelcomeBonusControl />
        </div>
      )}
      </div>

      {/* Shareable Links & Referral Card */}
      {isConnected && (
        <div className="mt-4 grid gap-3 lg:mt-0">
          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
                <GiftIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                Your Unique Referral Link
              </span>
            </div>
            <div className="flex gap-2">
              <TruncatedLinkInput value={refLink} />
              <button
                onClick={copyRefLink}
                className="h-9 shrink-0 rounded-lg bg-[var(--color-brand-500)] px-3 text-[11px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] flex items-center gap-1.5">
                <ZapIcon className="h-3.5 w-3.5 text-[var(--color-info)]" />
                Public Profile & Bet Share Link
              </span>
            </div>
            <div className="flex gap-2">
              <TruncatedLinkInput value={profileLink} />
              <button
                onClick={copyProfileLink}
                className="h-9 shrink-0 rounded-lg bg-[var(--color-bg-3)] px-3 text-[11px] font-bold text-white hover:bg-[var(--color-bg-4)]"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total bets" value={loading ? "—" : String(stats?.totalBets ?? 0)} Icon={TrophyIcon} accent="var(--color-warn)" />
        <StatCard label="Win rate" value={loading ? "—" : `${winRate.toFixed(1)}%`} Icon={BadgeCheck} accent={winRateColor} />
        <StatCard
          label="Current streak"
          value={loading ? "—" : `${streak} wins`}
          Icon={Flame}
          accent="var(--color-warn)"
          hint="Consecutive wins (positive) or losses (negative) across your most recent bets and parlays"
        />
        <StatCard
          label="Best streak"
          value={loading ? "—" : String(stats?.bestStreak ?? 0)}
          Icon={TrophyIcon}
          accent="#a78bfa"
          hint="Your longest winning streak on record"
        />
        <StatCard label="Total wagered" value={loading ? "—" : `$${stats?.totalWagered ?? "0.00"}`} Icon={ShieldIcon} accent="var(--color-info)" />
        <StatCard
          label="Net P&L"
          value={loading ? "—" : (() => {
            const n = parseFloat(stats?.netPnl ?? "0");
            return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
          })()}
          Icon={TrendUp}
          accent={parseFloat(stats?.netPnl ?? "0") >= 0 ? "var(--color-brand-500)" : "var(--color-live)"}
        />
        <StatCard
          label="Avg stake"
          value={loading || !stats?.totalBets ? "—" : `$${(parseFloat(stats.totalWagered) / stats.totalBets).toFixed(2)}`}
          Icon={ShieldIcon}
          accent="var(--color-brand-500)"
          hint="Total wagered divided by total bets"
        />
        <StatCard label="Won" value={loading ? "—" : String(stats?.won ?? 0)} Icon={TrendUp} accent="var(--color-brand-500)" />
      </div>

      {/* Quick Links */}
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <QuickLink href="/account/bets" label="My Bets" sub={`${stats?.totalBets ?? 0} total · ${stats?.won ?? 0} won`} Icon={Ticket} />
        <QuickLink href="/account/wallet" label="Wallet" sub={isConnected ? `${balanceFormatted} USDC balance` : "Sign in to view"} Icon={Wallet} />
        <QuickLink href="/ai-analytics" label="AI Signals & Auto-Pilot" sub="Model edge · +EV signals" Icon={Zap} />
      </div>

      {/* Activity Chart */}
      <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">30-day activity</p>
        <ActivityChart bets={bets} loading={loading} isConnected={isConnected} />
      </div>

      {/* Recent Activity */}
      <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-line-1)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Recent activity</p>
          <Link href="/account/bets" className="text-[12px] text-[var(--color-brand-500)] hover:underline">View all →</Link>
        </div>
        {!isConnected ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-ink-3)]">Sign in to view activity</div>
        ) : loading ? (
          <div className="space-y-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-[var(--color-bg-3)]/30" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <Ticket className="h-10 w-10 text-[var(--color-ink-4)]" />
            <div>
              <p className="text-[14px] font-bold text-white">No bets placed yet</p>
              <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
                Your wagers and their outcomes will show up here once you place your first one.
              </p>
            </div>
            <Link
              href="/sportsbook"
              className="mt-1 rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-[12px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-[var(--color-line-1)] px-4 py-3 text-[13px] last:border-0 hover:bg-[var(--color-bg-3)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-3)]">
                <ActivityTypeIcon type={a.type} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-white">{a.label}</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">{a.time}</p>
              </div>
              <span className="mono font-bold" style={{ color: a.color }}>{a.amount} USDC</span>
            </div>
          ))
        )}
      </div>

      {/* Username Setup Modal */}
      <SetUsernameModal
        open={usernameModalOpen}
        onClose={() => setUsernameModalOpen(false)}
        onUsernameSet={(newUsername) => {
          setUserMe((prev) => (prev ? { ...prev, username: newUsername } : null));
          fetchUserData();
        }}
      />

      {/* Avatar Selector Modal */}
      <AvatarSelectorModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentAvatar={userMe?.avatar}
        onAvatarSaved={(newAvatar) => {
          setUserMe((prev) => (prev ? { ...prev, avatar: newAvatar } : null));
          fetchUserData();
        }}
      />
    </div>
  );
}

/**
 * Read-only share-link input, scrolled to show its tail rather than its
 * head. These links always end in the meaningful part (a ref code or
 * username) with a fixed "https://sportystake.com/..." prefix in front —
 * on a narrow viewport the input can't show the whole string, and a plain
 * input truncates from the right, hiding exactly the part that matters.
 */
function TruncatedLinkInput({ value }: { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [value]);
  return (
    <input
      ref={ref}
      type="text"
      readOnly
      value={value}
      className="mono h-9 w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-2.5 text-[11px] font-semibold text-white outline-none"
    />
  );
}

function StatCard({
  label,
  value,
  Icon,
  accent,
  hint,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4" title={hint}>
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

function QuickLink({ href, label, sub, Icon }: { href: string; label: string; sub: string; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4 hover:border-[var(--color-line-2)] hover:bg-[var(--color-bg-3)] transition-colors">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-brand-500)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white">{label}</p>
        <p className="text-[11px] text-[var(--color-ink-3)] truncate">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[var(--color-ink-3)]" />
    </Link>
  );
}

const CHART_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function bucketByDay(bets: BetDTO[]): { vol: number; pnl: number }[] {
  const buckets = Array.from({ length: CHART_DAYS }, () => ({ vol: 0, pnl: 0 }));
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  for (const b of bets) {
    const ts = new Date(b.settledAt ?? b.createdAt).getTime();
    const daysAgo = Math.floor((startOfToday - ts) / MS_PER_DAY);
    if (daysAgo < 0 || daysAgo >= CHART_DAYS) continue;
    const idx = CHART_DAYS - 1 - daysAgo;
    const amount = parseFloat(b.amount);
    buckets[idx].vol += amount;
    if (b.status === "WON" || b.status === "CLAIMED") {
      buckets[idx].pnl += parseFloat(b.potentialPayout) - amount;
    } else if (b.status === "LOST") {
      buckets[idx].pnl -= amount;
    }
  }
  return buckets;
}

function ActivityChart({ bets, loading, isConnected }: { bets: BetDTO[]; loading: boolean; isConnected: boolean }) {
  const buckets = useMemo(() => bucketByDay(bets), [bets]);
  const W = 600, H = 80;

  if (!isConnected) {
    return <p className="py-6 text-center text-[13px] text-[var(--color-ink-3)]">Sign in to view your activity</p>;
  }
  if (loading) {
    return <div className="h-[100px] w-full animate-pulse rounded-md bg-[var(--color-bg-3)]/30" />;
  }
  if (bets.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[var(--color-ink-3)]">No activity in the last {CHART_DAYS} days</p>;
  }

  const maxVol = Math.max(1, ...buckets.map((d) => d.vol));
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      {buckets.map((d, i) => {
        const x = (i / (buckets.length - 1)) * W;
        const barH = d.vol > 0 ? Math.max(2, (d.vol / maxVol) * H) : 0;
        return (
          <rect key={i} x={x - 7} y={H - barH} width={14} height={barH} rx={3}
            fill={d.pnl >= 0 ? "rgba(0,231,1,0.3)" : "rgba(255,45,45,0.3)"} />
        );
      })}
      <text x={0} y={H + 16} fontSize={10} fill="var(--color-ink-4)">{CHART_DAYS} days ago</text>
      <text x={W} y={H + 16} fontSize={10} fill="var(--color-ink-4)" textAnchor="end">Today</text>
    </svg>
  );
}
