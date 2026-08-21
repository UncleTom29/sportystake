export const dynamic = "force-dynamic";
import { ok, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { MarketsRepo } from "@/lib/server/repos/markets.repo";
import { marketsToMatches } from "@/lib/adapters/marketToMatch";
import { getOnchainPoolStats } from "@/lib/server/chain";
import { getVirtualLiquidityConfig } from "@/lib/server/virtualLiquidityStore";
import { formatUsd } from "@/lib/format";
import type { SportSlug } from "@/components/icons/SportIcons";
import { compareLeagues } from "@/lib/leaguePriority";

export const runtime = "nodejs";

/**
 * Homepage data in one payload — moved off `/` itself (see src/app/page.tsx)
 * so the Cloudflare Pages build of the frontend never needs a direct Prisma
 * import (that build strips src/app/api entirely and proxies to this route
 * on the EC2-hosted backend instead, see next.config.ts's rewrites()).
 */
export const GET = withRequestId(async () => {
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [
    featured,
    football,
    allSports,
    byLeague,
    todayByLeague,
    sportsWagered,
    casinoWagered,
    onchainPool,
    userCount,
    topSportsWin,
    topCasinoWin,
  ] = await Promise.all([
    MarketsRepo.list({ featured: true, limit: 12 }),
    MarketsRepo.list({ sport: "football", limit: 20 }),
    MarketsRepo.list({ limit: 30 }),
    prisma.market.groupBy({
      by: ["leagueId", "leagueName", "countryCode", "sport"],
      where: { status: { in: ["OPEN", "SUSPENDED"] } },
      _count: { _all: true },
      orderBy: { _count: { leagueId: "desc" } },
      take: 50,
    }),
    prisma.market.groupBy({
      by: ["leagueId"],
      where: { startTime: { lte: todayEnd }, status: { in: ["OPEN", "SUSPENDED"] } },
      _count: { _all: true },
    }),
    prisma.bet.aggregate({ _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.casinoBet.aggregate({ _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    getOnchainPoolStats().catch(() => ({
      totalLiquidity: 0n,
      totalShares: 0n,
      lockedForPayouts: 0n,
      virtualLiquidity: 0n,
      shareValue: 10n ** 18n,
    })),
    prisma.user.count().catch(() => 0),
    prisma.bet.findFirst({
      where: { status: "WON" },
      orderBy: { potentialPayout: "desc" },
      select: { potentialPayout: true },
    }).catch(() => null),
    prisma.casinoBet.findFirst({
      where: { status: "WON" },
      orderBy: { payout: "desc" },
      select: { payout: true },
    }).catch(() => null),
  ]);

  const featuredMatches = marketsToMatches(featured.items, { isHot: true });
  const footballMatches = marketsToMatches(football.items);
  const generalMatches = marketsToMatches(allSports.items.filter((m) => m.sport !== "prediction-markets"));

  const hotOrAny =
    featuredMatches.length > 0
      ? featuredMatches.slice(0, 4)
      : footballMatches.length > 0
      ? footballMatches.slice(0, 4)
      : generalMatches.slice(0, 4);

  const eplMatches = footballMatches.slice(0, 5);
  const otherMatches = footballMatches.length > 5 ? footballMatches.slice(5, 12) : generalMatches.slice(4, 10);

  const todayMap = new Map(todayByLeague.map((r) => [r.leagueId, r._count._all]));
  const openMarketsTotal = byLeague.reduce((sum, r) => sum + r._count._all, 0);
  const todayMarketsTotal = todayByLeague.reduce((sum, r) => sum + r._count._all, 0);

  const topLeagues = byLeague
    .map((r) => ({
      id: r.leagueId,
      name: r.leagueName,
      countryCode: r.countryCode || "INT",
      sport: (r.sport ?? "football") as SportSlug,
      live: 0,
      today: todayMap.get(r.leagueId) ?? 0,
    }))
    .sort(compareLeagues)
    .slice(0, 20);

  const virtConfig = getVirtualLiquidityConfig();

  const sportsWageredRaw = sportsWagered?._sum?.amount ? Number(sportsWagered._sum.amount) / 1_000_000 : 0;
  const casinoWageredRaw = casinoWagered?._sum?.amount ? Number(casinoWagered._sum.amount) / 1_000_000 : 0;
  const totalWageredRawUsdc = sportsWageredRaw + casinoWageredRaw + (virtConfig.virtualWageredUsdc ?? 5000000);

  const totalWageredFormatted = formatUsd(totalWageredRawUsdc);
  const activeWalletsFormatted = userCount > 0 ? userCount.toLocaleString("en-US") : "—";

  const maxWinSports = topSportsWin?.potentialPayout ? Number(topSportsWin.potentialPayout) / 1_000_000 : 0;
  const maxWinCasino = topCasinoWin?.payout ? Number(topCasinoWin.payout) / 1_000_000 : 0;
  const maxWinRawUsdc = Math.max(maxWinSports, maxWinCasino);
  const maxWinFormatted = maxWinRawUsdc > 0 ? formatUsd(maxWinRawUsdc) : "—";

  return ok({
    hotOrAny,
    eplMatches,
    otherMatches,
    topLeagues,
    openMarketsTotal,
    todayMarketsTotal,
    totalWageredFormatted,
    activeWalletsFormatted,
    maxWinFormatted,
  });
});
