import Link from "next/link";
import { matches, casinoGames, topLeagues } from "@/lib/mockData";
import MatchCard from "@/components/sportsbook/MatchCard";
import MatchRow, { LeagueGroup } from "@/components/sportsbook/MatchRow";
import GameTile from "@/components/casino/GameTile";
import PromoCarousel from "@/components/marketing/PromoCarousel";
import StatsMarquee from "@/components/marketing/StatsMarquee";
import SectionHeader from "@/components/ui/SectionHeader";
import { SportIcon } from "@/components/icons/SportIcons";
import { LiveIcon, FlameIcon, CasinoChipIcon, TrophyIcon, SparkleIcon, ZapIcon, ArrowUpRight, ShieldIcon, BadgeCheck, ChevronRight } from "@/components/icons/UIIcons";
import Badge from "@/components/ui/Badge";

export default function Home() {
  const liveMatches = matches.filter((m) => m.isLive);
  const hot = matches.filter((m) => m.isHot).slice(0, 4);
  const eplMatches = matches.filter((m) => m.league === "Premier League");
  const otherSoccer = matches.filter(
    (m) => m.sportSlug === "soccer" && m.league !== "Premier League"
  );

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Promo + side stats */}
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <PromoCarousel />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Live now"
            value={`${liveMatches.length}`}
            sub="markets streaming"
            accent="var(--color-live)"
            Icon={LiveIcon}
          />
          <StatCard label="Total wagered" value="$124.8M" sub="all time" accent="var(--color-brand-500)" Icon={ZapIcon} />
          <StatCard label="LP yield" value="18.2%" sub="top APY" accent="#a78bfa" Icon={SparkleIcon} />
          <StatCard label="Biggest win" value="$1.84M" sub="this week" accent="var(--color-warn)" Icon={TrophyIcon} />
        </div>
      </div>

      <div className="mt-4 -mx-3 md:-mx-5">
        <StatsMarquee />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr]">
        {/* Hot events */}
        <section>
          <SectionHeader
            title="Hot events"
            subtitle="Trending markets right now"
            href="/sportsbook?tab=popular"
            Icon={FlameIcon}
            accent="#ff8a00"
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {hot.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>

        {/* Live strip */}
        <section>
          <SectionHeader
            title="Live now"
            subtitle="In-play matches updating in real time"
            href="/sportsbook?tab=live"
            Icon={LiveIcon}
            accent="var(--color-live)"
            right={
              <span className="mono flex items-center gap-1.5 rounded bg-[var(--color-live)]/15 px-2 py-1 text-[11px] font-bold text-[var(--color-live)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-live)] pulse-dot" />
                {liveMatches.length} live
              </span>
            }
          />
          <div className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)]">
            {liveMatches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>

        {/* Two-col split */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* EPL group */}
          <div>
            <SectionHeader title="Premier League" subtitle="Today & tomorrow" href="/sportsbook?league=epl" Icon={TrophyIcon} accent="#3b82f6" />
            <LeagueGroup league="Premier League" countryCode="ENG" sport="Soccer">
              {eplMatches.map((m) => <MatchRow key={m.id} match={m} />)}
            </LeagueGroup>
          </div>
          {/* Other soccer */}
          <div>
            <SectionHeader title="Top soccer" subtitle="Across Europe & global leagues" href="/sportsbook?sport=soccer" Icon={() => <SportIcon sport="soccer" />} accent="#22c55e" />
            <div className="space-y-3">
              <LeagueGroup league="La Liga" countryCode="ESP" sport="Soccer">
                {otherSoccer.filter((m) => m.league === "La Liga").map((m) => <MatchRow key={m.id} match={m} />)}
              </LeagueGroup>
              <LeagueGroup league="Bundesliga" countryCode="GER" sport="Soccer">
                {otherSoccer.filter((m) => m.league === "Bundesliga").map((m) => <MatchRow key={m.id} match={m} />)}
              </LeagueGroup>
              <LeagueGroup league="UEFA Champions League" countryCode="EUR" sport="Soccer">
                {otherSoccer.filter((m) => m.league.startsWith("UCL")).map((m) => <MatchRow key={m.id} match={m} />)}
              </LeagueGroup>
            </div>
          </div>
        </section>

        {/* Top leagues nav */}
        <section>
          <SectionHeader title="Top leagues" subtitle="Jump straight in" Icon={TrophyIcon} accent="#facc15" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
            {topLeagues.map((l) => (
              <Link
                key={l.slug}
                href={`/sportsbook?league=${l.slug}`}
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

        {/* Casino preview */}
        <section>
          <SectionHeader title="Casino · Originals" subtitle="House games · provably fair · on-chain" href="/casino" Icon={CasinoChipIcon} accent="#a78bfa" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6">
            {casinoGames.slice(0, 6).map((g) => (
              <GameTile key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* LP CTA */}
        <section className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6 md:p-8">
          <div className="bg-mesh absolute inset-0 opacity-80" />
          <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <Badge variant="brand">Earn · Non-custodial</Badge>
              <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                Back the house. Earn up to <span className="text-[var(--color-brand-500)]">18.2% APY</span>.
              </h3>
              <p className="mt-2 max-w-lg text-[13px] text-[var(--color-ink-2)] md:text-sm">
                Provide stablecoin liquidity to the sportsbook & casino vaults. Returns come from real gameplay margin —
                no token emissions, no smoke. Withdraw any time the vault has free capacity.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href="/pools"
                  className="inline-flex h-11 items-center gap-1.5 rounded-md bg-[var(--color-brand-500)] px-5 text-[14px] font-bold text-[var(--color-bg-0)] hover:bg-[var(--color-brand-400)]"
                >
                  Provide liquidity
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pools"
                  className="inline-flex h-11 items-center rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-1)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-bg-3)]"
                >
                  Read docs
                </Link>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-3)]">
                  <ShieldIcon className="h-3.5 w-3.5" />
                  Audited · ERC-4626 vaults
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
              <PoolCard name="Sportsbook Main" asset="USDT" apy={12.4} tvl="4.25M" />
              <PoolCard name="High Yield" asset="ETH" apy={18.2} tvl="1.64M" highlight />
              <PoolCard name="Casino Reserve" asset="USDC" apy={9.8} tvl="2.18M" />
              <PoolCard name="Stable Yield" asset="USDT" apy={7.5} tvl="0.87M" />
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Trust Icon={ShieldIcon} title="Non-custodial" sub="Your wallet. Your funds. Always." />
          <Trust Icon={ZapIcon} title="Instant settlement" sub="On-chain payouts the moment markets settle." />
          <Trust Icon={BadgeCheck} title="Provably fair" sub="Every casino spin verifiable on-chain." />
          <Trust Icon={SparkleIcon} title="Built on Arc" sub="High-throughput EVM · 18ms median latency." />
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mono text-2xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-3)]">{sub}</p>
    </div>
  );
}

function PoolCard({
  name,
  asset,
  apy,
  tvl,
  highlight,
}: {
  name: string;
  asset: string;
  apy: number;
  tvl: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg p-3 ${
        highlight
          ? "border border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/10"
          : "border border-[var(--color-line-1)] bg-[var(--color-bg-1)]"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{asset}</p>
      <p className="truncate text-[13px] font-bold text-white">{name}</p>
      <div className="mt-2 flex items-end justify-between">
        <span className="mono text-xl font-black text-[var(--color-brand-500)]">{apy}%</span>
        <span className="mono text-[10px] text-[var(--color-ink-3)]">TVL ${tvl}</span>
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
