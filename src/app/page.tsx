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
  ZapIcon,
  ArrowUpRight,
  ShieldIcon,
  BadgeCheck,
  ChevronRight,
  GiftIcon,
  TicketIcon,
  CopyIcon,
} from "@/components/icons/UIIcons";
import Badge from "@/components/ui/Badge";
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

      {/* 2. High-Converting Promotions Spotlight Grid */}
      <section className="mt-8">
        <SectionHeader
          title="Featured Promotions & Affiliate Rewards"
          subtitle="Boost your bankroll with 100% wager matches, lifetime referrals, and shared ticket payouts"
          Icon={GiftIcon}
          accent="#00e701"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PromoFeatureCard
            tag="First-Wager Match"
            title="$2,000 Welcome Bonus"
            sub="100% bonus match on your first settled wager on-chain. No KYC required, non-custodial wallet credit."
            cta="Claim $2,000 Bonus"
            href="/sportsbook"
            accent="#00e701"
            tnc="T&C apply · 100% match up to $2,000 on first wager"
            Icon={GiftIcon}
          />
          <PromoFeatureCard
            tag="100% Free AI"
            title="Free LLM Analytics"
            sub="Claude Fable AI powered predictive analytics, value odds scanner, and win probabilities for all matches."
            cta="Open AI Analytics"
            href="/ai-analytics"
            accent="#38bdf8"
            tnc="100% Free · Real-time AI sports predictions"
            Icon={ZapIcon}
          />
          <PromoFeatureCard
            tag="Perpetual Revenue Cut"
            title="Lifetime Referral Earnings"
            sub="Earn a perpetual percentage of all wagers placed by your invited friends for life."
            cta="Get Referral Link"
            href="/profile"
            accent="#2dc4ff"
            tnc="T&C apply · Up to 25% house margin share"
            Icon={TicketIcon}
          />
          <PromoFeatureCard
            tag="Affiliate Copy Bets"
            title="Shared Ticket Earnings"
            sub="Share your winning tickets on X & Telegram. Earn instant payouts when others copy."
            cta="Share Bet Slip"
            href="/sportsbook"
            accent="#ffb800"
            tnc="T&C apply · 2% volume commission on copies"
            Icon={CopyIcon}
          />
          <PromoFeatureCard
            tag="Quant Model Terminal"
            title="AI Match Predictions"
            sub="Real-time expected value (+EV) distributions, probability edges, and automated tailing."
            cta="Explore AI Picks"
            href="/ai-analytics"
            accent="#00e701"
            tnc="100% Free · Top 5 European Leagues"
            Icon={ZapIcon}
          />
        </div>
      </section>

      {/* 3. Provably Fair Casino Feature Spotlight Section */}
      <section className="mt-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-brand-500)]/30 bg-[var(--color-bg-2)] p-6 md:p-8 shadow-2xl">
          <div className="bg-mesh absolute inset-0 opacity-70" />
          <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">Provably Fair On-Chain</Badge>
                <span className="mono text-[10px] font-bold text-violet-300 uppercase tracking-wider">0% House Manipulation</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
                Cryptographically Verifiable Game Outcomes
              </h2>
              <p className="mt-2 max-w-xl text-[13px] text-[var(--color-ink-2)] md:text-sm">
                Every casino spin, roll, and flight is generated using SHA-256 commit-reveal seed hashing.
                The server seed hash is committed <strong className="text-white">before</strong> you place your bet, guaranteeing zero outcome manipulation. Anyone can verify fairness on-chain instantly.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2.5 max-w-lg">
                <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">1. Server Seed</span>
                  <p className="mono text-[11px] font-bold text-white truncate mt-0.5">SHA-256 Hash Committed</p>
                </div>
                <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">2. Client Seed</span>
                  <p className="mono text-[11px] font-bold text-[var(--color-brand-500)] truncate mt-0.5">User Provided / Random</p>
                </div>
                <div className="rounded-lg border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-ink-3)]">3. Outcome</span>
                  <p className="mono text-[11px] font-bold text-emerald-400 truncate mt-0.5">Deterministic Result</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/casino/crash"
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-5 text-[13px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-transform active:scale-95"
                >
                  Play Aviator
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/casino/dice"
                  className="inline-flex h-10 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
                >
                  Play Dice
                </Link>
              </div>
            </div>

            {/* Cryptographic Fairness Architecture */}
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30">
                  <ShieldIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-white">Pre-Committed Server Seed</h4>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">SHA-256 hash committed before player wagers are accepted, locking the outcome immutably.</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                  <ZapIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-white">Client-Supplied Entropy</h4>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">Player wallet client seed blends into the HMAC hash to prevent any house predictability.</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-white">Automated On-Chain Payouts</h4>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">Smart contracts credit winning bets directly without custodial intervention.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Dedicated Feature Spotlights: No KYC & Sub-Second Payouts */}
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Spotlight Card 1: No KYC & Non-Custodial */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
              <ShieldIcon className="h-6 w-6" />
            </div>
            <div>
              <span className="mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">Security & Privacy</span>
              <h3 className="text-xl font-black text-white">Zero KYC & 100% Non-Custodial</h3>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            Connect instantly with your Web3 wallet or 1-click Privy social login. No identity document uploads, no personal data forms, no verification delays. Your funds are held directly in non-custodial smart contracts on Arc EVM chain — never on a central server.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-cyan-400">Zero</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">KYC Required</p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-white">100%</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">Non-Custodial</p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-emerald-400">1-Click</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">Instant Access</p>
            </div>
          </div>
        </div>

        {/* Spotlight Card 2: Sub-Second On-Chain Payouts */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
              <ZapIcon className="h-6 w-6" />
            </div>
            <div>
              <span className="mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-500)]">On-Chain Speed</span>
              <h3 className="text-xl font-black text-white">Sub-Second Automated Payouts</h3>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            When a match settles or a casino round resolves, smart contracts execute your winnings payout on-chain automatically. No manual withdrawal approvals, no waiting for support teams, no pending transaction delays.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-[var(--color-brand-500)]">18ms</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">Median Latency</p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-white">Auto</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">Smart Payouts</p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-1)] p-2.5 text-center">
              <p className="mono text-lg font-black text-violet-300">Audited</p>
              <p className="text-[10px] text-[var(--color-ink-3)]">EVM Contracts</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-8">
        {/* 5. Hot events */}
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

        {/* 6. Two-col split: Top Football on left, Global Sports on right */}
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

        {/* 7. Top leagues nav */}
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

        {/* 8. Casino preview */}
        <section>
          <SectionHeader
            title="Casino · Originals"
            subtitle="House games · provably fair on-chain · instant payouts"
            href="/casino"
            Icon={CasinoChipIcon}
            accent="#a78bfa"
          />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6">
            {casinoGames.slice(0, 6).map((g) => (
              <GameTile key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* 9. Quantitative Model Spotlight Section */}
        <section className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
          <div className="bg-mesh absolute inset-0 opacity-80" />
          <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <Badge variant="brand">Quant Model Terminal</Badge>
              <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                Beat the market with <span className="text-[var(--color-brand-500)]">+EV AI Model Signals</span>.
              </h3>
              <p className="mt-2 max-w-lg text-[13px] text-[var(--color-ink-2)] md:text-sm">
                Our quantitative engine tracks expected goals (xG), injury distributions, and line dislocations across Europe&apos;s top 5 football leagues. Tail verified +EV signals or deploy autonomous agents with 1 click.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href="/ai-analytics"
                  className="inline-flex h-11 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-5 text-[14px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)] transition-transform active:scale-95"
                >
                  View Model Signals
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sportsbook"
                  className="inline-flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
                >
                  Explore Sportsbook
                </Link>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-3)]">
                  <ShieldIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                  100% Non-Custodial Smart Contract Escrow
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30">
                  <ZapIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-white">Autonomous Quantitative Engine</h4>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">Scans Europe&apos;s top domestic football leagues 24/7 for positive expected value (+EV).</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
                  <ShieldIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-white">Non-Custodial Escrow</h4>
                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">Automated 1-click tailing with payouts settled directly by smart contracts on Arc EVM.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Web3 Trust & Security Grid */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Trust Icon={ShieldIcon} title="No KYC & Non-Custodial" sub="Your wallet. Your funds. Instant 1-click access without documents." />
          <Trust Icon={ZapIcon} title="Sub-Second On-Chain Payouts" sub="Smart contracts execute instant payouts the moment events resolve." />
          <Trust Icon={BadgeCheck} title="Provably Fair On-Chain" sub="Cryptographic commit-reveal seed hashes verifiable for every spin & flight." />
          <Trust Icon={ZapIcon} title="Free LLM Analytics" sub="Real-time Claude Fable AI match predictions and value odds analysis." />
          <Trust Icon={BadgeCheck} title="Built on Arc EVM" sub="High-throughput EVM chain with 18ms median RPC response latency." />
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
  Icon: (p: { className?: string }) => React.ReactElement;
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
  Icon: (p: { className?: string }) => React.ReactElement;
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
