"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Favourites, Markets, BetSlip } from "@/lib/api-client";
import { useBetSlip } from "@/lib/betSlipStore";
import { useNotifications } from "@/lib/notificationStore";
import { marketsToMatches } from "@/lib/adapters/marketToMatch";
import type { Match } from "@/lib/mockData";
import { sportsList } from "@/lib/mockData";
import Sidebar, { type PopularFilter } from "@/components/layout/Sidebar";
import MatchRow, { LeagueGroup, type DisplayMarketKey } from "@/components/sportsbook/MatchRow";
import { SportIcon, type SportSlug } from "@/components/icons/SportIcons";
import { FlameIcon, StarIcon, TrophyIcon, FilterIcon } from "@/components/icons/UIIcons";

// Human-readable names for all known sport slugs.
const SPORT_NAMES: Record<string, string> = {
  ...Object.fromEntries(sportsList.map((s) => [s.slug, s.name])),
};
import type { OddsFormat } from "@/components/sportsbook/OddsButton";

type Tab = "all" | "1h" | "3h" | "12h" | "today" | "tomorrow";

const tabs: { id: Tab; label: string; Icon?: (p: { className?: string }) => React.ReactElement }[] = [
  { id: "all", label: "All" },
  { id: "1h", label: "1h" },
  { id: "3h", label: "3h" },
  { id: "12h", label: "12h" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
];

const MAJOR_SPORTS_ORDER = [
  "football",
  "soccer",
  "basketball",
  "tennis",
  "ice-hockey",
  "baseball",
  "american-football",
  "mma",
  "boxing",
  "esports",
  "volleyball",
  "table-tennis",
  "rugby",
  "cricket",
];

import { compareLeagues, getLeaguePriority, getSportPriority } from "@/lib/leaguePriority";

export default function SportsbookPage() {
  return (
    <Suspense fallback={<SkeletonGroups />}>
      <SportsbookPageInner />
    </Suspense>
  );
}

function SportsbookPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sport, setSport] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("all");
  const [leagueId, setLeagueId] = useState<number | undefined>(undefined);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [activePopular, setActivePopular] = useState<PopularFilter | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("decimal");
  const [timeMode, setTimeMode] = useState<"local" | "utc">("local");
  const [displayMarket, setDisplayMarket] = useState<DisplayMarketKey>("1X2");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);

  const [matches, setMatches] = useState<Match[]>([]);
  const [totalMarkets, setTotalMarkets] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sidebarSports, setSidebarSports] = useState<{ slug: SportSlug; name: string; count: number }[]>([]);
  const [sidebarLeagues, setSidebarLeagues] = useState<
    { id: number; name: string; sport: Parameters<typeof SportIcon>[0]["sport"]; country: string; live: number; total: number }[]
  >([]);
  const [popularCounts, setPopularCounts] = useState<Record<PopularFilter, number>>({
    hot: 0,
    favourites: 0,
  });
  const [favouriteMarketIds, setFavouriteMarketIds] = useState<string[]>([]);
  const [favouriteLeagueIds, setFavouriteLeagueIds] = useState<number[]>([]);
  const [requiresAuth, setRequiresAuth] = useState(false);

  const favouriteMarketSet = useMemo(() => new Set(favouriteMarketIds), [favouriteMarketIds]);
  const favouriteLeagueSet = useMemo(() => new Set(favouriteLeagueIds), [favouriteLeagueIds]);

  useEffect(() => {
    const qpSport = searchParams.get("sport") ?? "all";
    const qpTab = searchParams.get("tab") ?? "all";
    const qpLeague = searchParams.get("leagueId");
    const qpFeatured = searchParams.get("featured");
    const qpPopular = searchParams.get("popular");
    const qpBookCode = searchParams.get("bookCode") || searchParams.get("code");

    // Auto-load booked ticket from URL if present
    if (qpBookCode) {
      BetSlip.loadBooked(qpBookCode)
        .then((res) => {
          if (res.selections && res.selections.length) {
            useBetSlip.getState().loadSelections(res.selections);
            useNotifications.getState().pushToast({
              kind: "success",
              title: "Ticket loaded",
              body: `Booked ticket ${res.code} loaded into betslip (${res.selections.length} selections)`,
            });
          }
        })
        .catch(() => {});
    }

    const nextSport = qpSport;
    const nextTab: Tab =
      ["all", "1h", "3h", "12h", "today", "tomorrow"].includes(qpTab) ? (qpTab as Tab) : "all";

    const parsedLeague = qpLeague ? Number(qpLeague) : undefined;
    const nextLeagueId = parsedLeague && Number.isFinite(parsedLeague) ? parsedLeague : undefined;

    const nextPopular: PopularFilter | null = qpPopular === "hot" || qpPopular === "favourites" ? qpPopular : null;

    setSport((cur) => (cur === nextSport ? cur : nextSport));
    setTab((cur) => (cur === nextTab ? cur : nextTab));
    setLeagueId((cur) => (cur === nextLeagueId ? cur : nextLeagueId));
    setFeaturedOnly((cur) => (cur === (qpFeatured === "1") ? cur : qpFeatured === "1"));
    setActivePopular((cur) => (cur === nextPopular ? cur : nextPopular));
  }, [searchParams]);

  function pushFilters(next: {
    sport?: string;
    tab?: Tab;
    leagueId?: number;
    featured?: boolean;
    popular?: PopularFilter | null;
  }) {
    const q = new URLSearchParams(searchParams.toString());
    const nextSport = next.sport ?? sport;
    const nextTab = next.tab ?? tab;
    const nextLeagueId = next.leagueId !== undefined ? next.leagueId : leagueId;
    const nextFeatured = next.featured ?? featuredOnly;
    const nextPopular = next.popular !== undefined ? next.popular : activePopular;

    if (nextSport === "all") q.delete("sport");
    else q.set("sport", nextSport);

    if (nextTab === "all") q.delete("tab");
    else q.set("tab", nextTab);

    if (nextLeagueId) q.set("leagueId", String(nextLeagueId));
    else q.delete("leagueId");

    if (nextFeatured) q.set("featured", "1");
    else q.delete("featured");

    if (nextPopular) q.set("popular", nextPopular);
    else q.delete("popular");

    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function refreshFavourites() {
    try {
      const fav = await Favourites.list();
      setFavouriteMarketIds(fav.marketIds);
      setFavouriteLeagueIds(fav.leagueIds);
      setRequiresAuth(fav.requiresAuth);
    } catch {
      setFavouriteMarketIds([]);
      setFavouriteLeagueIds([]);
    }
  }

  async function toggleMarketFavourite(marketId: string) {
    const exists = favouriteMarketSet.has(marketId);
    try {
      if (exists) await Favourites.removeMarket(marketId);
      else await Favourites.saveMarket(marketId);
      await refreshFavourites();
    } catch {
      // Ignore auth/network failures in UI.
    }
  }

  async function toggleLeagueFavourite(id: number) {
    const exists = favouriteLeagueSet.has(id);
    try {
      if (exists) await Favourites.removeLeague(id);
      else await Favourites.saveLeague(id);
      await refreshFavourites();
    } catch {
      // Ignore auth/network failures in UI.
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const activeSport = sport === "all" ? undefined : sport;
    const fetcher =
      activePopular === "favourites"
        ? Markets.list({
            limit: activeSport ? 1000 : 20000,
            sport: activeSport,
            ...(leagueId ? { leagueId } : {}),
          }).then((mRes) => {
            const items = mRes.items.filter(
              (item) => favouriteMarketSet.has(item.id) || favouriteLeagueSet.has(item.leagueId),
            );
            return { items };
          })
        : activePopular === "hot"
          ? Markets.upcoming(activeSport, leagueId)
          : tab === "today"
            ? Markets.today(activeSport, leagueId)
            : tab === "tomorrow"
              ? Markets.tomorrow(activeSport, leagueId)
              : Markets.list({
                  limit: activeSport ? 1000 : 20000,
                  sport: activeSport,
                  ...(leagueId ? { leagueId } : {}),
                  ...(featuredOnly ? { featured: true } : {}),
                });

    fetcher
      .then((res) => {
        if (cancelled) return;
        let items = ("items" in res ? res.items : []).filter(
          (item) => item.status !== "SETTLED" && item.status !== "CANCELLED" && item.sport !== "prediction-markets",
        );

        const now = Date.now();
        if (tab === "1h") {
          items = items.filter((item) => {
            const t = new Date(item.startTime).getTime();
            return t >= now && t <= now + 60 * 60 * 1000;
          });
        } else if (tab === "3h") {
          items = items.filter((item) => {
            const t = new Date(item.startTime).getTime();
            return t >= now && t <= now + 3 * 60 * 60 * 1000;
          });
        } else if (tab === "12h") {
          items = items.filter((item) => {
            const t = new Date(item.startTime).getTime();
            return t >= now && t <= now + 12 * 60 * 60 * 1000;
          });
        } else if (activePopular === "hot") {
          const cutoff = now + 2 * 60 * 60 * 1000;
          items = items.filter((item) => {
            const t = new Date(item.startTime).getTime();
            return t >= now - 5 * 60 * 1000 && t <= cutoff;
          });
        }

        setMatches(marketsToMatches(items, { isHot: activePopular === "hot" }));
        setTotalMarkets(items.length);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Failed to load markets");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, sport, leagueId, featuredOnly, activePopular, favouriteLeagueSet, favouriteMarketSet]);

  useEffect(() => {
    let cancelled = false;
    const activeSport = sport === "all" ? undefined : sport;

    Promise.all([
      Markets.sports(),
      Markets.leagues(activeSport),
      Markets.upcoming(activeSport),
      Favourites.list(),
    ])
      .then(([sportsRes, leaguesRes, upcomingRes, favRes]) => {
        if (cancelled) return;

        // Build sidebar sports: prioritize major sports, then sort rest by available event count.
        // Prediction markets are strictly excluded.
        const liveApiSports = sportsRes.items
          .filter((item) => item.total > 0 && item.sport !== "prediction-markets")
          .sort((a, b) => {
            const pa = getSportPriority(a.sport);
            const pb = getSportPriority(b.sport);
            if (pa !== pb) return pa - pb;
            return b.total - a.total;
          })
          .map((item) => ({
            slug: item.sport as SportSlug,
            name: SPORT_NAMES[item.sport] ?? item.sport,
            count: item.total,
          }));
        setSidebarSports(liveApiSports);

        const dedupedLeagues = Array.from(
          leaguesRes.items
            .map((l) => ({
              id: l.id,
              name: l.name,
              sport: l.sport as Parameters<typeof SportIcon>[0]["sport"],
              country: l.countryCode || l.country.slice(0, 3).toUpperCase(),
              live: l.live,
              today: l.matchesToday,
              total: l.total,
            }))
            .reduce<Map<number, { id: number; name: string; sport: Parameters<typeof SportIcon>[0]["sport"]; country: string; live: number; today: number; total: number }>>((acc, league) => {
              const prev = acc.get(league.id);
              if (
                !prev ||
                league.live > prev.live ||
                (league.live === prev.live && league.today > prev.today) ||
                (league.live === prev.live && league.today === prev.today && league.total > prev.total)
              ) {
                acc.set(league.id, league);
              }
              return acc;
            }, new Map())
            .values(),
        );

        const sortedLeagues = dedupedLeagues.sort(compareLeagues);
        setSidebarLeagues(sortedLeagues);
        setFavouriteMarketIds(favRes.marketIds);
        setFavouriteLeagueIds(favRes.leagueIds);
        setRequiresAuth(favRes.requiresAuth);

        const now = Date.now();
        const cutoff = now + 2 * 60 * 60 * 1000;
        const hotCount = upcomingRes.items.filter((item) => {
          const t = new Date(item.startTime).getTime();
          return t >= now - 5 * 60 * 1000 && t <= cutoff;
        }).length;

        setPopularCounts({
          hot: hotCount,
          favourites: favRes.total,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSidebarLeagues([]);
          setPopularCounts({ hot: 0, favourites: 0 });
          setFavouriteMarketIds([]);
          setFavouriteLeagueIds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sport]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const arr = map.get(m.league) ?? [];
      arr.push(m);
      map.set(m.league, arr);
    }

    // Always sort matches within each group by kick-off time.
    for (const ms of map.values()) {
      ms.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    if (activePopular === "hot") {
      return Array.from(map.entries()).sort(([, a], [, b]) => {
        const at = Math.min(...a.map((m) => new Date(m.startsAt).getTime()));
        const bt = Math.min(...b.map((m) => new Date(m.startsAt).getTime()));
        return at - bt;
      });
    }

    return Array.from(map.entries()).sort(([nameA, msA], [nameB, msB]) => {
      const sportA = msA[0]?.sportSlug ?? "football";
      const sportB = msB[0]?.sportSlug ?? "football";
      const countryA = msA[0]?.country;
      const countryB = msB[0]?.country;
      return compareLeagues(
        { name: nameA, sport: sportA, country: countryA },
        { name: nameB, sport: sportB, country: countryB }
      );
    });
  }, [matches, sidebarLeagues, activePopular]);

  const activeLeague = sidebarLeagues.find((l) => l.id === leagueId);

  return (
    <div className="mx-auto flex max-w-[1400px] gap-5 px-3 py-4 md:px-5">
      <Sidebar
        sports={sidebarSports}
        leagues={sidebarLeagues}
        popularCounts={popularCounts}
        activeSport={sport === "all" ? undefined : sport}
        activeLeagueId={leagueId}
        activePopular={activePopular}
        onSportChange={(slug) => pushFilters({ sport: slug, leagueId: undefined, featured: false, popular: null })}
        onLeagueChange={(id, leagueSport) =>
          pushFilters({
            sport: leagueSport,
            leagueId: id,
            featured: false,
            popular: null,
          })
        }
        onPopularChange={(key) => {
          pushFilters({ tab: "all", featured: false, popular: key });
        }}
        mobileOpen={mobileFiltersOpen}
        onMobileClose={() => setMobileFiltersOpen(false)}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-bg-2)] text-[var(--color-brand-500)]">
              {activePopular === "hot" ? (
                <FlameIcon className="h-5 w-5 text-warn" />
              ) : activePopular === "favourites" ? (
                <StarIcon className="h-5 w-5 text-warn" />
              ) : (
                <SportIcon sport={(sport === "all" ? "football" : sport) as Parameters<typeof SportIcon>[0]["sport"]} className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-white">
                {activePopular === "hot"
                  ? "Upcoming"
                  : activePopular === "favourites"
                    ? "Favourites"
                    : activeLeague
                      ? `${activeLeague.name} · ${SPORT_NAMES[sport] ?? "Sport"}`
                      : sport === "all"
                        ? "All sports"
                        : SPORT_NAMES[sport] ?? sport}
              </h1>
              <p className="text-[12px] text-[var(--color-ink-3)]">
                {loading
                  ? "Loading..."
                  : activePopular === "hot"
                    ? `${totalMarkets} ${totalMarkets === 1 ? "match" : "matches"} kicking off in the next 2 hours`
                    : activePopular === "favourites"
                      ? `${totalMarkets} saved ${totalMarkets === 1 ? "match" : "matches"}`
                      : `${totalMarkets} matches`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Below lg: Sidebar's Popular/Sports/Leagues content is
                otherwise unreachable (the <aside> is lg:only), so this is
                the only entry point to league filtering and
                Popular/Favourites on mobile and tablet. */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="relative flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)] lg:hidden"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Filters
              {(leagueId !== undefined || activePopular !== null) && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-500)] ring-2 ring-[var(--color-bg-1)]" />
              )}
            </button>

            {/* Market/Odds/Time — one row on desktop; a single popover
                trigger below lg so 3 selects don't wrap across the header
                and push match results further down. */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setDisplayOptionsOpen((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)]"
              >
                Display
              </button>
              {displayOptionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDisplayOptionsOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-2 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-2)] p-3 shadow-2xl">
                    <DisplaySelect label="Market" value={displayMarket} onChange={(v) => setDisplayMarket(v as DisplayMarketKey)} options={[
                      ["1X2", "1X2 / Winner"], ["over_under_25", "Over / Under 2.5"], ["btts", "Both Teams to Score"], ["double_chance", "Double Chance"],
                    ]} />
                    <DisplaySelect label="Odds" value={oddsFormat} onChange={(v) => setOddsFormat(v as OddsFormat)} options={[
                      ["decimal", "Decimal"], ["fractional", "Fractional"], ["american", "American"],
                    ]} />
                    <DisplaySelect label="Time" value={timeMode} onChange={(v) => setTimeMode(v as "local" | "utc")} options={[
                      ["local", "Local Time"], ["utc", "UTC"],
                    ]} />
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <label className="mono flex h-9 items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)]">
                Market
                <select
                  value={displayMarket}
                  onChange={(e) => setDisplayMarket(e.target.value as DisplayMarketKey)}
                  className="bg-transparent text-[12px] font-semibold text-white outline-none cursor-pointer"
                >
                  <option value="1X2" className="bg-[var(--color-bg-2)]">1X2 / Winner</option>
                  <option value="over_under_25" className="bg-[var(--color-bg-2)]">Over / Under 2.5</option>
                  <option value="btts" className="bg-[var(--color-bg-2)]">Both Teams to Score</option>
                  <option value="double_chance" className="bg-[var(--color-bg-2)]">Double Chance</option>
                </select>
              </label>

              <label className="mono flex h-9 items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)]">
                Odds
                <select
                  value={oddsFormat}
                  onChange={(e) => setOddsFormat(e.target.value as OddsFormat)}
                  className="bg-transparent text-[12px] font-semibold text-white outline-none cursor-pointer"
                >
                  <option value="decimal" className="bg-[var(--color-bg-2)]">Decimal</option>
                  <option value="fractional" className="bg-[var(--color-bg-2)]">Fractional</option>
                  <option value="american" className="bg-[var(--color-bg-2)]">American</option>
                </select>
              </label>

              <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 text-[12px] font-semibold text-[var(--color-ink-1)]">
                Time
                <select
                  value={timeMode}
                  onChange={(e) => setTimeMode(e.target.value as "local" | "utc")}
                  className="bg-transparent text-[12px] font-semibold text-white outline-none cursor-pointer"
                >
                  <option value="local" className="bg-[var(--color-bg-2)]">Local Time</option>
                  <option value="utc" className="bg-[var(--color-bg-2)]">UTC</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          <SportPill active={sport === "all"} onClick={() => pushFilters({ sport: "all", leagueId: undefined, popular: null })} label="All" count={sport === "all" ? matches.length : undefined} />
          {sidebarSports.map((s) => (
            <SportPill
              key={s.slug}
              active={sport === s.slug}
              onClick={() => pushFilters({ sport: s.slug, leagueId: undefined, featured: false, popular: null })}
              label={s.name}
              count={s.count}
              Icon={() => <SportIcon sport={s.slug} />}
            />
          ))}
        </div>

        <div className="mb-4 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() =>
                  pushFilters({
                    tab: t.id,
                    featured: false,
                    popular: null,
                  })
                }
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-bg-3)] text-white"
                    : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)] hover:text-white"
                }`}
              >
                {t.Icon && <t.Icon className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto hidden shrink-0 items-center gap-2 px-2 text-[11px] text-[var(--color-ink-3)] md:flex">
            <FlameIcon className="h-3 w-3 text-[var(--color-warn)]" />
            Top boost: +12%
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-[var(--color-live)]/30 bg-[var(--color-live)]/5 py-10 text-center">
            <p className="text-[13px] font-bold text-[var(--color-live)]">Failed to load markets</p>
            <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">{error}</p>
          </div>
        ) : loading ? (
          <SkeletonGroups />
        ) : matches.length === 0 ? (
          activePopular === "hot" ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-line-1 bg-bg-2 py-20 text-center">
              <FlameIcon className="h-8 w-8 text-warn opacity-40" />
              <p className="text-[13px] font-semibold text-ink-2">No matches in the next 2 hours</p>
              <p className="text-[11px] text-ink-3">Check back soon — this updates as kick-offs approach</p>
            </div>
          ) : activePopular === "favourites" ? (
            requiresAuth ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-line-1 bg-bg-2 py-20 text-center">
                <StarIcon className="h-8 w-8 text-warn opacity-40" />
                <p className="text-[13px] font-semibold text-ink-2">Sign in to view your favourites</p>
                <p className="text-[11px] text-ink-3">Connect your wallet to save and track your favourite matches</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-line-1 bg-bg-2 py-20 text-center">
                <StarIcon className="h-8 w-8 text-warn opacity-40" />
                <p className="text-[13px] font-semibold text-ink-2">No favourites yet</p>
                <p className="text-[11px] text-ink-3">Star any match or league to save it here</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-line-1 bg-bg-2 py-20 text-center">
              <TrophyIcon className="h-8 w-8 text-ink-4" />
              <p className="text-[13px] text-ink-2">No matches in this view</p>
              <p className="text-[11px] text-ink-3">Try a different sport or time filter</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {grouped.map(([league, ms]) => {
              const first = ms[0];
              const leagueMeta = sidebarLeagues.find((l) => l.name === league);
              const hasDraw = ms.some((m) => m.drawOdds != null && m.drawOdds > 0);
              return (
                <LeagueGroup
                  key={league}
                  league={league}
                  countryCode={first.country}
                  sport={first.sport}
                  hasDraw={hasDraw}
                  displayMarket={displayMarket}
                  isFavourite={leagueMeta ? favouriteLeagueSet.has(leagueMeta.id) : false}
                  onToggleFavourite={leagueMeta ? () => toggleLeagueFavourite(leagueMeta.id) : undefined}
                >
                  {ms.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      isFavourite={favouriteMarketSet.has(m.id)}
                      onToggleFavourite={toggleMarketFavourite}
                      oddsFormat={oddsFormat}
                      timeMode={timeMode}
                      displayMarket={displayMarket}
                    />
                  ))}
                </LeagueGroup>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DisplaySelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[var(--color-ink-1)]">
      <span className="text-[var(--color-ink-3)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mono h-8 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-0)] px-2 text-[12px] font-semibold text-white outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-[var(--color-bg-2)]">{l}</option>
        ))}
      </select>
    </label>
  );
}

function SkeletonGroups() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)]">
          <div className="h-9 animate-pulse bg-[var(--color-bg-3)]/40" />
          <div className="space-y-2 p-3">
            <div className="h-14 animate-pulse rounded bg-[var(--color-bg-3)]/40" />
            <div className="h-14 animate-pulse rounded bg-[var(--color-bg-3)]/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SportPill({
  active,
  onClick,
  label,
  count,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  Icon?: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${
        active
          ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)]"
          : "bg-[var(--color-bg-2)] text-[var(--color-ink-1)] hover:bg-[var(--color-bg-3)]"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      {count !== undefined && (
        <span className={`mono text-[10px] ${active ? "text-[var(--color-bg-0)]/70" : "text-[var(--color-ink-3)]"}`}>{count}</span>
      )}
    </button>
  );
}
