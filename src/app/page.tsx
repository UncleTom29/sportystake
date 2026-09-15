import Link from "next/link";
import MatchCard from "@/components/sportsbook/MatchCard";
import MatchRow, { LeagueGroup } from "@/components/sportsbook/MatchRow";
import GameTile from "@/components/casino/GameTile";
import PromoCarousel from "@/components/marketing/PromoCarousel";
import StatsMarquee from "@/components/marketing/StatsMarquee";
import SectionHeader from "@/components/ui/SectionHeader";
import { SportIcon } from "@/components/icons/SportIcons";
import type { SportSlug } from "@/components/icons/SportIcons";
import {
  FlameIcon,
  CasinoChipIcon,
  TrophyIcon,
  TrendUp,
  ArrowUpRight,
  ShieldIcon,
  BadgeCheck,
  ChevronRight,
  GiftIcon,
  TicketIcon,
  CopyIcon,
} from "@/components/icons/UIIcons";
import { Layers } from "lucide-react";
import { casinoGames, type Match } from "@/lib/mockData";
import { internalApiBase } from "@/lib/server/internalApiBase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HomeOverview {
  hotOrAny: Match[];
  eplMatches: Match[];
  otherMatches: Match[];
  topLeagues: { id: number; name: string; countryCode: string; sport: SportSlug; live: number; today: number }[];
  openMarketsTotal: number;
  todayMarketsTotal: number;
  totalWageredFormatted: string;
  activeWalletsFormatted: string;
  maxWinFormatted: string;
}

export default async function Home() {
  // Fetched from a dedicated API route (not queried directly here) so this
  // page can run unmodified on both the EC2 backend build and the
  // Cloudflare Pages frontend build — the latter has no direct Postgres
  // connection and proxies /api/* to EC2 instead (see next.config.ts).
  const res = await fetch(`${internalApiBase()}/api/home/overview`, { cache: "no-store" });
  const { data } = (await res.json()) as { data: HomeOverview };
  const {
    hotOrAny,
    eplMatches,
    otherMatches,
    topLeagues,
    openMarketsTotal,
    todayMarketsTotal,
    totalWageredFormatted,
    activeWalletsFormatted,
    maxWinFormatted,
  } = data;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      <h1 className="sr-only">
        SportyStake — Non-Custodial Decentralized Crypto Sportsbook &amp; On-Chain Casino
      </h1>
      {/* 1. Hero Carousel */}
      <div>
        <PromoCarousel />
      </div>

      {/* Marquee ticker */}
      <div className="mt-4 -mx-3 md:-mx-5">
        <StatsMarquee
          maxWin={maxWinFormatted}
        />
      </div>

      <div className="mt-8 space-y-8">
        {/* 2. Hot events */}
        <section>
          <SectionHeader
            title="Hot Events"
            subtitle="Trending sportsbook markets right now"
            href="/sportsbook?featured=1&popular=hot"
            Icon={FlameIcon}
            accent="#ff8a00"
          />
          {hotOrAny.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hotOrAny.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <EmptyHint>No markets available right now. The oracle may still be syncing — check back in a minute.</EmptyHint>
          )}
        </section>

        {/* 3. Top Football on left, Global Sports on right */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeader
              title="Top Football"
              subtitle="Live & Upcoming Fixtures"
              href="/sportsbook?sport=football"
              Icon={TrophyIcon}
              accent="#3b82f6"
            />
            {eplMatches.length > 0 ? (
              <LeagueGroup league="Top Football" countryCode="SOC" sport="Football">
                {eplMatches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </LeagueGroup>
            ) : (
              <EmptyHint>No upcoming football fixtures right now.</EmptyHint>
            )}
          </div>
          <div>
            <SectionHeader
              title="Global Matches"
              subtitle="Across global leagues & sports"
              href="/sportsbook"
              Icon={() => <SportIcon sport="soccer" />}
              accent="#22c55e"
            />
            <div className="space-y-3">
              {otherMatches.length > 0 ? (
                <LeagueGroup league="Global Fixtures" countryCode="INT" sport="Sports">
                  {otherMatches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </LeagueGroup>
              ) : (
                <EmptyHint>No upcoming global fixtures.</EmptyHint>
              )}
            </div>
          </div>
        </section>

        {/* 4. Top leagues quick jump */}
        <section>
          <SectionHeader title="Top Leagues" subtitle="Jump straight to top competitions" Icon={TrophyIcon} accent="#facc15" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
            {topLeagues.map((l) => (
              <Link
                key={`${l.id}-${l.name}`}
                href={`/sportsbook?leagueId=${l.id}&sport=${l.sport}`}
                className="group flex items-center gap-2 rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-2.5 transition-colors hover:border-[var(--color-line-2)] hover:bg-[var(--color-bg-3)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-ink-2)] group-hover:text-white">
                  <SportIcon sport={l.sport} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-white">{l.name}</p>
                  <p className="mono truncate text-[10px] text-[var(--color-ink-3)]">{l.today} today</p>
                </div>
                {l.live > 0 && (
                  <span className="mono flex items-center gap-1 rounded bg-[var(--color-live)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-live)]">
                    {l.live}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* 5. Casino Originals */}
        <section>
          <SectionHeader
            title="Casino · Originals"
            subtitle="House games · provably fair on-chain · instant payouts"
            href="/casino"
            Icon={CasinoChipIcon}
            accent="var(--color-brand-500)"
          />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6">
            {casinoGames.slice(0, 6).map((g) => (
              <GameTile key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* 6. Featured Promotions */}
        <section>
          <SectionHeader
            title="Featured Promotions"
            subtitle="Wager match bonuses, multi-market parlays, and rewards"
            Icon={GiftIcon}
            accent="#00e701"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PromoFeatureCard
              tag="Welcome Bonus"
              title="$2,000 Wager Match"
              sub="100% bonus match on your first settled wager on-chain. Instant USDC credit with zero KYC required."
              cta="Claim Bonus"
              href="/sportsbook"
              accent="#00e701"
              tnc="100% match up to $2,000 USDC · Terms apply"
              Icon={GiftIcon}
            />
            <PromoFeatureCard
              tag="Multi-Market"
              title="Prediction Parlays"
              sub="Combine crypto and real-world event predictions with football matches for high multiplied odds."
              cta="Build Parlay"
              href="/prediction-markets"
              accent="#2dc4ff"
              tnc="Compounded multi-leg odds"
              Icon={Layers}
            />
            <PromoFeatureCard
              tag="Affiliate Program"
              title="Lifetime Referrals"
              sub="Earn a perpetual percentage of all wagers placed by your invited friends for life."
              cta="Get Invite Link"
              href="/profile"
              accent="#2dc4ff"
              tnc="Up to 25% house margin share"
              Icon={TicketIcon}
            />
            <PromoFeatureCard
              tag="Social Bets"
              title="Shared Tickets"
              sub="Share winning slips on X and Telegram. Earn instant volume commissions when other players tail."
              cta="View Social Feed"
              href="/social"
              accent="#ffb800"
              tnc="Instant payouts on copied bets"
              Icon={CopyIcon}
            />
          </div>
        </section>

        {/* 7. Web3 Trust & Security Grid */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Trust Icon={ShieldIcon} title="Zero KYC & Non-Custodial" sub="Direct smart contract wallet access without ID uploads." />
          <Trust Icon={TrendUp} title="Sub-Second Automated Payouts" sub="Smart contracts execute instant payouts the moment events resolve." />
          <Trust Icon={BadgeCheck} title="Provably Fair On-Chain" sub="Cryptographic commit-reveal seed hashes verifiable for every round." />
          <Trust Icon={BadgeCheck} title="Built on Arc EVM" sub="High-throughput blockchain with sub-second finality and low fees." />
        </section>
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line-1)] bg-[var(--color-bg-2)]/40 p-6 text-center text-[12px] text-[var(--color-ink-3)]">
      {children}
    </div>
  );
}

function PromoFeatureCard({
  tag,
  title,
  sub,
  cta,
  href,
  accent,
  tnc,
  Icon,
}: {
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  accent: string;
  tnc: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-lg hover:border-[var(--color-line-2)] transition-all">
      <div>
        <div className="flex items-center justify-between">
          <span
            className="mono inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
          >
            {tag}
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-white">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <h3 className="mt-3 text-lg font-black text-white">{title}</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]">{sub}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--color-line-1)]">
        <Link
          href={href}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-bold transition-colors"
          style={{ background: accent, color: "#000000" }}
        >
          {cta}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <p className="mt-2 text-[10px] text-center text-[var(--color-ink-4)] font-medium">{tnc}</p>
      </div>
    </div>
  );
}

function Trust({
  Icon,
  title,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-3)] text-[var(--color-brand-500)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[13px] font-bold text-white">{title}</p>
        <p className="text-[12px] text-[var(--color-ink-3)]">{sub}</p>
      </div>
      <ChevronRight className="ml-auto h-4 w-4 self-center text-[var(--color-ink-4)]" />
    </div>
  );
}
