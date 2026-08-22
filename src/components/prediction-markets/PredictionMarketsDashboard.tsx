"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OddsButton from "@/components/sportsbook/OddsButton";
import { SearchIcon, CloseIcon, ChevronLeft, ChevronRight, ArrowUpRight } from "@/components/icons/UIIcons";
import {
  Flame,
  Trophy,
  Swords,
  Gamepad2,
  TrendingUp,
  CircleDot,
  Activity,
  Shield,
  BarChart3,
  Clock,
  Filter,
} from "lucide-react";
import type { MarketDTO } from "@/lib/types";

interface Props {
  initialMarkets: MarketDTO[];
}

export type CategoryKey =
  | "all"
  | "football"
  | "esports"
  | "tennis"
  | "baseball"
  | "basketball"
  | "combat"
  | "american_football"
  | "crypto_politics";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  badge: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "all", label: "All Markets", badge: "All", Icon: Flame },
  { key: "football", label: "Football", badge: "Football", Icon: Trophy },
  { key: "esports", label: "Esports", badge: "Esports", Icon: Gamepad2 },
  { key: "tennis", label: "Tennis", badge: "Tennis", Icon: Activity },
  { key: "baseball", label: "Baseball", badge: "Baseball", Icon: CircleDot },
  { key: "basketball", label: "Basketball", badge: "Basketball", Icon: TrendingUp },
  { key: "combat", label: "MMA & Boxing", badge: "Combat", Icon: Swords },
  { key: "american_football", label: "American Football", badge: "NFL", Icon: Shield },
  { key: "crypto_politics", label: "Crypto & Specials", badge: "Specials", Icon: BarChart3 },
];

export function getCategory(market: MarketDTO): CategoryKey {
  const q = (typeof market.metadata?.question === "string" ? market.metadata.question : "") || market.homeTeam || "";
  const league = market.leagueName || "";
  const desc = (typeof market.metadata?.description === "string" ? market.metadata.description : "") || "";
  const text = `${q} ${market.homeTeam} ${league} ${desc}`.toLowerCase();

  // 1. Esports & Gaming
  if (
    text.includes("lol:") || text.includes("esports") || text.includes("counter-strike") ||
    text.includes("cs:go") || text.includes("cs2") || text.includes("dota") ||
    text.includes("rainbow six") || text.includes("mobile legends") || text.includes("valorant") ||
    text.includes("baron nashor") || text.includes("slay a dragon") || text.includes("map 1") ||
    text.includes("map 2") || text.includes("game 1") || text.includes("game 2") ||
    text.includes("lpl") || text.includes("lck") || text.includes("lec") || text.includes("lcs") ||
    text.includes("overwatch") || text.includes("rocket league") || text.includes("call of duty") ||
    text.includes("blast premier") || text.includes("pgl major")
  ) {
    return "esports";
  }

  // 2. Tennis
  if (
    text.includes("tennis") || text.includes("atp") || text.includes("wta") ||
    text.includes("itf") || text.includes("open:") || text.includes("classic:") ||
    text.includes("wimbledon") || text.includes("us open") || text.includes("australian open") ||
    text.includes("french open") || text.includes("roland garros") || text.includes("total sets") ||
    text.includes("set 1") || text.includes("set 2") || text.includes("set winner")
  ) {
    return "tennis";
  }

  // 3. MMA & Combat Sports
  if (
    text.includes("ufc") || text.includes("mma") || text.includes("boxing") ||
    text.includes("fight night") || text.includes("bout") || text.includes("prelims") ||
    text.includes("heavyweight") || text.includes("middleweight") || text.includes("welterweight") ||
    text.includes("lightweight") || text.includes("featherweight") || text.includes("bantamweight") ||
    text.includes("flyweight") || text.includes("knockout") || text.includes("tko") || text.includes("pfl") ||
    text.includes("bellator")
  ) {
    return "combat";
  }

  // 4. Baseball (MLB)
  if (
    text.includes("mlb") || text.includes("baseball") || text.includes("home runs") ||
    text.includes("strikeouts") || text.includes("innings") || text.includes("red sox") ||
    text.includes("yankees") || text.includes("dodgers") || text.includes("blue jays") ||
    text.includes("cardinals") || text.includes("mariners") || text.includes("cubs") ||
    text.includes("white sox") || text.includes("astros") || text.includes("braves") ||
    text.includes("phillies") || text.includes("mets") || text.includes("padres") ||
    text.includes("giants") || text.includes("guardians") || text.includes("royals") ||
    text.includes("tigers") || text.includes("twins") || text.includes("brewers") ||
    text.includes("pirates") || text.includes("reds") || text.includes("diamondbacks") ||
    text.includes("rockies") || text.includes("marlins") || text.includes("nationals") ||
    text.includes("athletics") || text.includes("rays") || text.includes("orioles")
  ) {
    return "baseball";
  }

  // 5. Basketball (NBA, WNBA, EuroLeague)
  if (
    text.includes("nba") || text.includes("wnba") || text.includes("basketball") ||
    text.includes("euroleague") || text.includes("celtics") || text.includes("lakers") ||
    text.includes("warriors") || text.includes("bucks") || text.includes("nuggets") ||
    text.includes("heat") || text.includes("76ers") || text.includes("suns") ||
    text.includes("clippers") || text.includes("mavericks") || text.includes("timberwolves") ||
    text.includes("knicks") || text.includes("cavaliers") || text.includes("pacers") ||
    text.includes("thunder") || text.includes("points o/u") || text.includes("rebounds") ||
    text.includes("assists")
  ) {
    return "basketball";
  }

  // 6. American Football (NFL, College Football)
  if (
    text.includes("nfl") || text.includes("pro football") || text.includes("super bowl") ||
    text.includes("touchdown") || text.includes("quarterback") || text.includes("chiefs") ||
    text.includes("eagles") || text.includes("49ers") || text.includes("bills") ||
    text.includes("cowboys") || text.includes("ravens") || text.includes("dolphins") ||
    text.includes("packers") || text.includes("lions") || text.includes("texans") ||
    text.includes("jets") || text.includes("patriots") || text.includes("steelers")
  ) {
    return "american_football";
  }

  // 7. Crypto, Politics & Macro
  if (
    text.includes("bitcoin") || text.includes("btc") || text.includes("crypto") ||
    text.includes("ethereum") || text.includes("eth") || text.includes("solana") ||
    text.includes("fed") || text.includes("interest rate") || text.includes("election") ||
    text.includes("president") || text.includes("senate") || text.includes("trump") ||
    text.includes("harris") || text.includes("biden") || text.includes("inflation") ||
    text.includes("gdp") || text.includes("spacex") || text.includes("openai")
  ) {
    return "crypto_politics";
  }

  // 8. Soccer / Football
  if (
    text.includes(" fc") || text.includes("fc ") || text.includes("united") ||
    text.includes("city") || text.includes("corners") || text.includes("premier league") ||
    text.includes("la liga") || text.includes("serie a") || text.includes("bundesliga") ||
    text.includes("ligue 1") || text.includes("champions league") || text.includes("europa") ||
    text.includes("copa") || text.includes("first team to score") || text.includes("exact score") ||
    text.includes("team to advance") || text.includes("both teams to score") || text.includes("btts") ||
    text.includes("clean sheet") || text.includes("handicap") || text.includes("spread") ||
    text.includes("liga mx") || text.includes("brasileirão") || text.includes("eredivisie") ||
    text.includes("vs.") || text.includes(" vs ")
  ) {
    return "football";
  }

  return "crypto_politics";
}

function getCategoryBadgeLabel(cat: CategoryKey): string {
  switch (cat) {
    case "football": return "Football";
    case "esports": return "Esports";
    case "tennis": return "Tennis";
    case "baseball": return "MLB";
    case "basketball": return "NBA";
    case "combat": return "MMA / UFC";
    case "american_football": return "NFL";
    case "crypto_politics": return "Specials";
    default: return "Market";
  }
}

function predictionBundle(market: MarketDTO) {
  return market.odds.find((bundle) => bundle.marketType === "binary" || bundle.marketType === "multi_outcome");
}

const ITEMS_PER_PAGE = 24;

export default function PredictionMarketsDashboard({ initialMarkets }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"volume" | "closing_soon" | "newest">("volume");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter valid prediction markets
  const validMarkets = useMemo(() => {
    return initialMarkets.filter((market) => predictionBundle(market)?.selections.length);
  }, [initialMarkets]);

  // Pre-classify all markets for speed and precise filtering
  const classifiedMarkets = useMemo(() => {
    return validMarkets.map((m) => ({
      market: m,
      category: getCategory(m),
    }));
  }, [validMarkets]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      all: classifiedMarkets.length,
      football: 0,
      esports: 0,
      tennis: 0,
      baseball: 0,
      basketball: 0,
      combat: 0,
      american_football: 0,
      crypto_politics: 0,
    };

    for (const item of classifiedMarkets) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [classifiedMarkets]);

  // Filtered and sorted markets
  const filteredMarkets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return classifiedMarkets
      .filter(({ market, category }) => {
        const question = typeof market.metadata?.question === "string" ? market.metadata.question : market.homeTeam;
        const league = market.leagueName || "";
        const desc = typeof market.metadata?.description === "string" ? market.metadata.description : "";

        // Category filter
        if (selectedCategory !== "all" && category !== selectedCategory) {
          return false;
        }

        // Search query filter
        if (
          query &&
          !question.toLowerCase().includes(query) &&
          !league.toLowerCase().includes(query) &&
          !desc.toLowerCase().includes(query)
        ) {
          return false;
        }

        // Time filter
        const rawEnd = typeof market.metadata?.endDate === "string" ? market.metadata.endDate : market.startTime;
        const endTime = new Date(rawEnd).getTime();

        if (timeFilter === "today" && (endTime < now || endTime > now + dayMs)) {
          return false;
        }
        if (timeFilter === "week" && (endTime < now || endTime > now + 7 * dayMs)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const volA = typeof a.market.metadata?.volume === "number" ? a.market.metadata.volume : 0;
        const volB = typeof b.market.metadata?.volume === "number" ? b.market.metadata.volume : 0;
        const timeA = new Date(typeof a.market.metadata?.endDate === "string" ? a.market.metadata.endDate : a.market.startTime).getTime();
        const timeB = new Date(typeof b.market.metadata?.endDate === "string" ? b.market.metadata.endDate : b.market.startTime).getTime();

        if (sortBy === "volume") return volB - volA;
        if (sortBy === "closing_soon") return timeA - timeB;
        if (sortBy === "newest") return new Date(b.market.startTime).getTime() - new Date(a.market.startTime).getTime();
        return 0;
      });
  }, [classifiedMarkets, selectedCategory, searchQuery, sortBy, timeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE) || 1;
  const paginatedMarkets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMarkets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMarkets, currentPage]);

  const handleCategoryChange = (key: CategoryKey) => {
    setSelectedCategory(key);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(({ key, label, Icon }) => {
          const isActive = selectedCategory === key;
          const count = categoryCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all ${
                isActive
                  ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-lg shadow-[var(--color-brand-500)]/20"
                  : "border border-[var(--color-line-1)] bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:border-[var(--color-line-2)] hover:text-white"
              }`}
            >
              <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? "text-[var(--color-bg-0)]" : "text-[var(--color-brand-500)]"}`} />
              <span>{label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                  isActive ? "bg-[var(--color-bg-0)]/20 text-[var(--color-bg-0)]" : "bg-[var(--color-bg-1)] text-[var(--color-ink-3)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-3 md:p-4">
        {/* Search Input */}
        <div className="relative min-w-[260px] flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search prediction markets, teams, fighters, players..."
            className="h-10 w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)] pl-10 pr-9 text-[13px] text-white placeholder-[var(--color-ink-3)] outline-none transition-colors focus:border-[var(--color-brand-500)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] hover:text-white"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {/* Time Filter */}
          <div className="flex items-center rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
            <button
              onClick={() => {
                setTimeFilter("all");
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                timeFilter === "all" ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => {
                setTimeFilter("today");
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                timeFilter === "today" ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setTimeFilter("week");
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                timeFilter === "week" ? "bg-[var(--color-bg-3)] text-white" : "text-[var(--color-ink-3)] hover:text-white"
              }`}
            >
              This Week
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-semibold text-[var(--color-ink-1)] outline-none cursor-pointer"
            >
              <option value="volume" className="bg-[var(--color-bg-2)] text-white">
                Highest Volume
              </option>
              <option value="closing_soon" className="bg-[var(--color-bg-2)] text-white">
                Closing Soonest
              </option>
              <option value="newest" className="bg-[var(--color-bg-2)] text-white">
                Newest Listed
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-[13px] text-[var(--color-ink-3)] px-1">
        <p>
          Showing <span className="font-bold text-white">{filteredMarkets.length}</span> live market{filteredMarkets.length === 1 ? "" : "s"}
        </p>
        <p>
          Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}
        </p>
      </div>

      {/* Market Cards Grid */}
      {paginatedMarkets.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-[var(--color-ink-3)]" />
          <h3 className="mt-3 text-base font-bold text-white">No markets found</h3>
          <p className="mt-1 text-[13px] text-[var(--color-ink-2)]">
            Try adjusting your search query or selecting a different category tab.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedMarkets.map(({ market, category }) => {
            const bundle = predictionBundle(market);
            if (!bundle) return null;

            const question = typeof market.metadata?.question === "string" ? market.metadata.question : market.homeTeam;
            const description = typeof market.metadata?.description === "string" ? market.metadata.description : null;
            const rawEnd = typeof market.metadata?.endDate === "string" ? market.metadata.endDate : market.startTime;
            const volume = typeof market.metadata?.volume === "number" ? market.metadata.volume : 0;
            const endDate = new Date(rawEnd);
            const formattedEnd = endDate.toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            const topSelections = [...bundle.selections].sort((a, b) => a.valueX1000 - b.valueX1000);
            const shownSelections = topSelections.slice(0, 4);
            const hiddenCount = topSelections.length - shownSelections.length;

            // Implied probabilities calculation
            const bestSelection = topSelections[0];
            const impliedProb = bestSelection ? Math.round((1000 / bestSelection.valueX1000) * 100) : 50;
            const badgeText = getCategoryBadgeLabel(category);

            return (
              <div
                key={market.id}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-5 shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-line-2)] hover:shadow-2xl"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="mono rounded bg-[var(--color-brand-500)]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/30">
                        {badgeText}
                      </span>
                      {bundle.marketType === "multi_outcome" && (
                        <span className="mono rounded bg-[var(--color-bg-1)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-ink-3)] border border-[var(--color-line-1)]">
                          {topSelections.length} Choices
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-3)]">
                      <Clock className="h-3 w-3" />
                      {formattedEnd}
                    </span>
                  </div>

                  {/* Question */}
                  <Link
                    href={`/sportsbook/match/${market.id}`}
                    className="mt-3 block font-bold text-white transition-colors hover:text-[var(--color-brand-500)] text-[15px] leading-snug line-clamp-2"
                  >
                    {question}
                  </Link>

                  {/* League / Tournament Subtitle */}
                  {market.leagueName && market.leagueName !== question && (
                    <p className="mt-1 text-[11px] text-[var(--color-ink-3)] truncate">
                      {market.leagueName}
                    </p>
                  )}

                  {description && (
                    <p className="mt-2 line-clamp-2 text-[12px] text-[var(--color-ink-3)]">
                      {description}
                    </p>
                  )}

                  {/* Implied Probability Bar */}
                  {bestSelection && (
                    <div className="mt-4 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--color-ink-2)] truncate max-w-[180px]">
                          Leading: <span className="text-white font-bold">{bestSelection.label}</span>
                        </span>
                        <span className="mono font-black text-[var(--color-brand-500)]">{impliedProb}% Implied</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-3)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-brand-500)] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, impliedProb))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Selections & Odds Buttons */}
                <div className="mt-4 pt-4 border-t border-[var(--color-line-1)]">
                  <div className="grid grid-cols-2 gap-2">
                    {shownSelections.map((selection) => (
                      <OddsButton
                        key={`${market.id}-${selection.outcome}`}
                        matchId={market.id}
                        matchLabel={question}
                        market="Prediction"
                        selection={selection.label}
                        label={selection.label}
                        odds={selection.valueX1000 / 1000}
                      />
                    ))}
                  </div>

                  {hiddenCount > 0 && (
                    <Link
                      href={`/sportsbook/match/${market.id}`}
                      className="mt-2.5 block text-center text-[11px] font-bold text-[var(--color-ink-3)] transition-colors hover:text-white"
                    >
                      +{hiddenCount} more outcome{hiddenCount === 1 ? "" : "s"} →
                    </Link>
                  )}

                  {/* Card Footer */}
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-ink-3)]">
                    <span className="mono flex items-center gap-1 font-semibold">
                      <BarChart3 className="h-3 w-3 text-[var(--color-brand-500)]" />
                      Vol: ${Math.round(volume).toLocaleString()}
                    </span>
                    <Link
                      href={`/sportsbook/match/${market.id}`}
                      className="flex items-center gap-0.5 font-bold text-[var(--color-brand-500)] hover:underline"
                    >
                      Trade Market
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-9 items-center gap-1 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 text-[12px] font-bold text-white transition-colors hover:bg-[var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 3 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              const isCurrent = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`mono h-9 w-9 rounded-xl text-[12px] font-bold transition-all ${
                    isCurrent
                      ? "bg-[var(--color-brand-500)] text-[var(--color-bg-0)] shadow-lg shadow-[var(--color-brand-500)]/20"
                      : "border border-[var(--color-line-1)] bg-[var(--color-bg-2)] text-[var(--color-ink-2)] hover:text-white"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 items-center gap-1 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] px-3 text-[12px] font-bold text-white transition-colors hover:bg-[var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
