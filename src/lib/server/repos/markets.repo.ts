/**
 * Markets repository. The oracle writes here via the write-through worker;
 * API routes read from here.
 */
import { prisma, type Prisma } from "@/lib/server/db";
import { redis } from "@/lib/server/redis";
import type { MarketDTO, MarketStatus, OddsBundle, BookmakerOddsEntry } from "@/lib/types";

type OddsSnapshotRow = { marketType: string; bookmaker: string; outcomes: Prisma.JsonValue; capturedAt: Date };
type MarketRow = Awaited<ReturnType<typeof prisma.market.findFirst>> & {
  oddsSnapshots?: OddsSnapshotRow[];
};

function toDto(m: NonNullable<MarketRow>): MarketDTO {
  const snapshots = (m.oddsSnapshots ?? []).sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );

  // Best snapshot per marketType (most recent wins across all bookmakers).
  const odds = snapshots.reduce<Map<string, OddsBundle>>((acc, s) => {
    if (acc.has(s.marketType)) return acc;
    const outcomes = (s.outcomes as { outcome: number; label: string; valueX1000: number }[]) ?? [];
    acc.set(s.marketType, {
      marketType: s.marketType as OddsBundle["marketType"],
      selections: outcomes,
    });
    return acc;
  }, new Map());

  // All bookmaker snapshots (for comparison tables on detail page).
  // Keep only the most-recent snapshot per (bookmaker, marketType).
  const seenBkMt = new Set<string>();
  const bookmakerOdds: BookmakerOddsEntry[] = [];
  for (const s of snapshots) {
    const key = `${s.bookmaker}:${s.marketType}`;
    if (seenBkMt.has(key)) continue;
    seenBkMt.add(key);
    bookmakerOdds.push({
      bookmaker: s.bookmaker,
      marketType: s.marketType as BookmakerOddsEntry["marketType"],
      selections: (s.outcomes as { outcome: number; label: string; valueX1000: number }[]) ?? [],
      capturedAt: s.capturedAt.toISOString(),
    });
  }

  const marketsCount = Array.from(odds.values()).reduce((sum, bundle) => sum + bundle.selections.length, 0);

  return {
    id: m.id,
    externalId: m.externalId,
    fixtureId: Number(m.fixtureId),
    sport: m.sport ?? "football",
    leagueId: m.leagueId,
    leagueName: m.leagueName,
    leagueLogo: m.leagueLogo ?? "",
    country: m.country,
    countryCode: (m.countryCode ?? "") as MarketDTO["countryCode"],
    homeTeam: m.homeTeam,
    homeTeamId: Number(m.homeTeamId),
    homeTeamLogo: m.homeTeamLogo ?? "",
    awayTeam: m.awayTeam,
    awayTeamId: Number(m.awayTeamId),
    awayTeamLogo: m.awayTeamLogo ?? "",
    startTime: m.startTime.toISOString(),
    closesAt: m.closesAt.toISOString(),
    status: m.status as MarketStatus,
    liveMinute: m.liveMinute ?? undefined,
    homeScore: m.homeScore ?? undefined,
    awayScore: m.awayScore ?? undefined,
    winningOutcome: m.winningOutcome ?? undefined,
    isFeatured: m.isFeatured,
    metadata: (m.metadata as Record<string, unknown> | null) ?? undefined,
    odds: Array.from(odds.values()),
    bookmakerOdds,
    marketsCount,
  };
}

export const MarketsRepo = {
  /** Map a raw market row (with optional oddsSnapshots) into the API DTO. */
  toDto,

  async byId(id: string): Promise<MarketDTO | null> {
    const cacheKey = `cache:market:id:${id}`;
    try {
      const cached = await redis().get(cacheKey);
      if (cached) return JSON.parse(cached) as MarketDTO;
    } catch {}

    const m = await prisma.market.findUnique({
      where: { id },
      include: { oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 200 } },
    });
    const dto = m ? toDto(m) : null;
    if (dto) {
      try {
        await redis().set(cacheKey, JSON.stringify(dto), "EX", 5);
      } catch {}
    }
    return dto;
  },

  async list(opts: {
    status?: MarketStatus;
    leagueId?: number;
    leaguePattern?: string;
    sport?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: MarketDTO[]; total: number }> {
    const cacheKey = `cache:market:list:${JSON.stringify(opts)}`;
    try {
      const cached = await redis().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const where: Prisma.MarketWhereInput = {
      status: opts.status ?? { in: ["OPEN", "SUSPENDED"] },
      closesAt: { gt: new Date() },
      ...(opts.leagueId ? { leagueId: opts.leagueId } : {}),
      ...(opts.leaguePattern ? { leagueName: { contains: opts.leaguePattern, mode: "insensitive" } } : {}),
      ...(opts.sport
        ? { sport: opts.sport }
        : { sport: { not: "prediction-markets" } }),
      ...(opts.featured ? { isFeatured: true } : {}),
    };

    let [items, total] = await Promise.all([
      prisma.market.findMany({
        where,
        include: { oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 50 } },
        orderBy: { startTime: "asc" },
        take: opts.limit ?? 30,
        skip: opts.offset ?? 0,
      }),
      prisma.market.count({ where }),
    ]);

    // Fallback: If featured items are requested but few/none are flagged in DB,
    // automatically backfill with the soonest open sports markets so UI is never empty.
    if (opts.featured && items.length < (opts.limit ?? 4)) {
      const fallbackWhere: Prisma.MarketWhereInput = {
        status: { in: ["OPEN", "SUSPENDED"] },
        closesAt: { gt: new Date() },
        id: { notIn: items.map((i) => i.id) },
        ...(opts.sport ? { sport: opts.sport } : {}),
      };
      const extraItems = await prisma.market.findMany({
        where: fallbackWhere,
        include: { oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 50 } },
        orderBy: { startTime: "asc" },
        take: (opts.limit ?? 30) - items.length,
      });
      items = [...items, ...extraItems];
      total = items.length;
    }

    const result = { items: items.map(toDto), total };
    try {
      await redis().set(cacheKey, JSON.stringify(result), "EX", 5);
    } catch {}

    return result;
  },

  async live(sport?: string, leagueId?: number): Promise<MarketDTO[]> {
    const cacheKey = `cache:market:live:${sport ?? "all"}:${leagueId ?? "all"}`;
    try {
      const cached = await redis().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const now = new Date();
    // Matches older than 130 minutes (2h 10m) are no longer live. Filter out stale fixtures.
    const minStartTime = new Date(now.getTime() - 130 * 60 * 1000);

    const rows = await prisma.market.findMany({
      where: {
        status: "LIVE",
        startTime: { gte: minStartTime },
        ...(sport ? { sport } : { sport: { not: "prediction-markets" } }),
        ...(leagueId ? { leagueId } : {}),
      },
      include: { oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 50 } },
      orderBy: { startTime: "asc" },
    });
    const result = rows.map(toDto);
    try {
      await redis().set(cacheKey, JSON.stringify(result), "EX", 3);
    } catch {}
    return result;
  },

  async upsertFromOracle(input: {
    id: string;
    externalId: string;
    fixtureId: number | bigint;
    sport?: string;
    leagueId: number;
    leagueName: string;
    leagueLogo?: string;
    country: string;
    countryCode?: string;
    season: number;
    round: string | null;
    homeTeam: string; homeTeamId: number | bigint; homeTeamLogo?: string;
    awayTeam: string; awayTeamId: number | bigint; awayTeamLogo?: string;
    startTime: Date;
    closesAt: Date;
    status: MarketStatus;
    isFeatured?: boolean;
    metadata?: Prisma.JsonValue;
    homeScore?: number; awayScore?: number; liveMinute?: number;
  }) {
    const isFeatured = input.isFeatured ?? /premier|la liga|serie a|bundesliga|champions league|europa|mls|copa|nba|nfl/i.test(input.leagueName);

    // Upsert by fixtureId (not externalId) so that provider-prefix migrations
    // (e.g. 1xcorp: → 1xbet:) don't hit a unique constraint on fixtureId and
    // fail silently. The externalId is updated in place on each sync.
    return prisma.market.upsert({
      where: { fixtureId: BigInt(input.fixtureId) },
      update: {
        externalId: input.externalId,
        sport: input.sport ?? "football",
        leagueName: input.leagueName,
        leagueLogo: input.leagueLogo ?? null,
        country: input.country,
        countryCode: input.countryCode ?? null,
        season: input.season,
        round: input.round ?? "",
        homeTeam: input.homeTeam, homeTeamId: BigInt(input.homeTeamId), homeTeamLogo: input.homeTeamLogo ?? null,
        awayTeam: input.awayTeam, awayTeamId: BigInt(input.awayTeamId), awayTeamLogo: input.awayTeamLogo ?? null,
        startTime: input.startTime,
        closesAt: input.closesAt,
        status: input.status,
        isFeatured,
        metadata: input.metadata ?? undefined,
        homeScore: input.homeScore ?? null,
        awayScore: input.awayScore ?? null,
        liveMinute: input.liveMinute ?? null,
      },
      create: {
        id: input.id,
        externalId: input.externalId,
        fixtureId: BigInt(input.fixtureId),
        sport: input.sport ?? "football",
        leagueId: input.leagueId, leagueName: input.leagueName, leagueLogo: input.leagueLogo ?? null,
        country: input.country, countryCode: input.countryCode ?? null,
        season: input.season, round: input.round ?? "",
        homeTeam: input.homeTeam, homeTeamId: BigInt(input.homeTeamId), homeTeamLogo: input.homeTeamLogo ?? null,
        awayTeam: input.awayTeam, awayTeamId: BigInt(input.awayTeamId), awayTeamLogo: input.awayTeamLogo ?? null,
        startTime: input.startTime,
        closesAt: input.closesAt,
        status: input.status,
        isFeatured,
        metadata: input.metadata ?? undefined,
        homeScore: input.homeScore ?? null,
        awayScore: input.awayScore ?? null,
        liveMinute: input.liveMinute ?? null,
      },
    });
  },

  async setStatus(id: string, status: MarketStatus, winningOutcome?: number) {
    return prisma.market.update({
      where: { id },
      data: {
        status,
        ...(winningOutcome !== undefined ? { winningOutcome } : {}),
      },
    });
  },

  async insertOddsSnapshot(input: {
    marketId: string;
    marketType: string;
    bookmaker: string;
    outcomes: { outcome: number; label: string; valueX1000: number }[];
  }) {
    // Replace strategy: delete the existing snapshot for this (market, type, bookmaker)
    // tuple before inserting the new one. Caps storage at ~1 row per tuple instead of
    // growing unboundedly with every scrape cycle (~2777 new rows per 3-min tick).
    const [, snapshot] = await prisma.$transaction([
      prisma.oddsSnapshot.deleteMany({
        where: {
          marketId: input.marketId,
          marketType: input.marketType,
          bookmaker: input.bookmaker,
        },
      }),
      prisma.oddsSnapshot.create({
        data: {
          marketId: input.marketId,
          marketType: input.marketType,
          bookmaker: input.bookmaker,
          outcomes: input.outcomes,
        },
      }),
    ]);
    return snapshot;
  },
};
