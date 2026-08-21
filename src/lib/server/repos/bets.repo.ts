/**
 * Bets repository — placement, listing, status transitions.
 * Wraps Prisma so route handlers stay declarative and the DTO mapping is
 * centralized.
 */
import { prisma, type Prisma } from "@/lib/server/db";
import type { BetDTO, BetStatus, Address, MarketType } from "@/lib/types";

const ONE_USDC = 1_000_000n;

export function usdcFromString(s: string): bigint {
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * ONE_USDC + BigInt(padded || "0");
}

export function usdcToString(n: bigint): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / ONE_USDC;
  const frac = (abs % ONE_USDC).toString().padStart(6, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

type BetRow = Awaited<ReturnType<typeof prisma.bet.findFirst>> & {
  user?: { walletAddress: string } | null;
  market?: {
    homeTeam: string;
    awayTeam: string;
    homeScore?: number | null;
    awayScore?: number | null;
    status?: string | null;
    metadata: Prisma.JsonValue | null;
  } | null;
};

function toDto(b: NonNullable<BetRow>): BetDTO {
  const metadata = (b.market?.metadata as Record<string, unknown> | null) ?? null;
  const question = typeof metadata?.question === "string" ? metadata.question : null;
  return {
    id: b.id,
    userId: b.userId,
    userAddress: (b.user?.walletAddress ?? "") as Address,
    marketId: b.marketId,
    marketLabel: question ?? (b.market ? `${b.market.homeTeam} vs ${b.market.awayTeam}` : ""),
    marketType: b.marketType as MarketType,
    outcome: b.outcome,
    selectionLabel: b.selectionLabel,
    amount: usdcToString(b.amount),
    oddsX1000: b.oddsX1000,
    potentialPayout: usdcToString(b.potentialPayout),
    status: b.status as BetStatus,
    isLive: b.isLive,
    isPublic: b.isPublic,
    txHash: b.txHash ?? undefined,
    createdAt: b.placedAt.toISOString(),
    settledAt: b.settledAt?.toISOString(),
    homeScore: b.market?.homeScore !== null ? (b.market?.homeScore ?? undefined) : undefined,
    awayScore: b.market?.awayScore !== null ? (b.market?.awayScore ?? undefined) : undefined,
    homeTeam: b.market?.homeTeam ?? undefined,
    awayTeam: b.market?.awayTeam ?? undefined,
    marketStatus: b.market?.status ?? undefined,
  };
}

type ParlayLegMarket = {
  homeTeam: string;
  awayTeam: string;
  metadata: Prisma.JsonValue | null;
  startTime: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

type ParlayRow = Awaited<ReturnType<typeof prisma.parlay.findFirst>> & {
  user?: { walletAddress: string } | null;
  legs?: {
    marketId: string;
    selectionLabel: string;
    marketType: string | null;
    oddsX1000: number;
    result: string;
    market?: ParlayLegMarket | null;
  }[];
};

function legMarketLabel(market?: ParlayLegMarket | null): string {
  if (!market) return "Unknown market";
  const metadata = market.metadata as Record<string, unknown> | null;
  const question = typeof metadata?.question === "string" ? metadata.question : null;
  return question ?? `${market.homeTeam} vs ${market.awayTeam}`;
}

/**
 * Parlays live in a separate table from single Bets (see prisma/schema.prisma)
 * but render in the same chronological feed — BetDTO.parlayId exists
 * specifically so the frontend can tell the two apart. marketType/outcome
 * aren't meaningful for a parlay as a whole; marketId/oddsX1000 fall back to
 * the first leg / the combined odds respectively. `legs` carries the real
 * per-match breakdown so bet history can show what was actually played,
 * not just a flattened "N-Leg Parlay" summary.
 */
function parlayToDto(p: NonNullable<ParlayRow>): BetDTO {
  const legs = p.legs ?? [];
  return {
    id: p.id,
    userId: p.userId,
    userAddress: (p.user?.walletAddress ?? "") as Address,
    marketId: legs[0]?.marketId ?? "",
    marketLabel: `${legs.length}-Leg Parlay`,
    marketType: "parlay",
    outcome: 0,
    selectionLabel: legs.map((l) => l.selectionLabel).join(" + "),
    amount: usdcToString(p.stake),
    oddsX1000: Number(p.combinedOddsX1000),
    potentialPayout: usdcToString(p.potentialPayout),
    status: p.status as BetStatus,
    isLive: false,
    isPublic: true,
    parlayId: p.id,
    txHash: p.txHash ?? undefined,
    createdAt: p.placedAt.toISOString(),
    settledAt: p.settledAt?.toISOString(),
    legs: legs.map((l) => ({
      marketId: l.marketId,
      marketLabel: legMarketLabel(l.market),
      marketType: l.marketType ?? undefined,
      selectionLabel: l.selectionLabel,
      oddsX1000: l.oddsX1000,
      result: l.result as "PENDING" | "WON" | "LOST" | "VOID",
      matchTime: (l.market?.startTime ?? p.placedAt).toISOString(),
      homeTeam: l.market?.homeTeam ?? "",
      awayTeam: l.market?.awayTeam ?? "",
      homeScore: l.market?.homeScore ?? undefined,
      awayScore: l.market?.awayScore ?? undefined,
      marketStatus: l.market?.status ?? "OPEN",
    })),
  };
}

const CASINO_GAME_LABEL: Record<string, string> = {
  CRASH: "Aviator (Crash)",
  DICE: "Provably Fair Dice",
  SLOTS: "Slots",
  BLACKJACK: "Blackjack Pro",
  ROULETTE: "Roulette 3D",
  BACCARAT: "Baccarat Squeeze",
};

/** CasinoStatus has no BettingCore equivalent for CLAIMED (casino payouts
 *  settle automatically, no separate claim step) and REFUNDED isn't a
 *  BetStatus value — mapped to CANCELLED, the closest existing meaning
 *  ("stake returned, not a win or loss"). */
function casinoStatusToBetStatus(status: string): BetStatus {
  return status === "REFUNDED" ? "CANCELLED" : (status as BetStatus);
}

type CasinoBetRow = Awaited<ReturnType<typeof prisma.casinoBet.findFirst>> & {
  user?: { walletAddress: string } | null;
};

/**
 * CasinoBet lives in its own table (see prisma/schema.prisma) — no
 * marketId/odds/selectionLabel in the sportsbook sense, so those fields
 * get sensible stand-ins rather than left blank. `users.repo.ts`'s
 * account-level stats() already folds these into "Total Bets"/"Total
 * Wagered"; without this mapping, bet history disagreed with those
 * numbers (a casino-only bettor saw real totals up top and an empty list
 * below).
 */
function casinoBetToDto(cb: NonNullable<CasinoBetRow>): BetDTO {
  const multiplier = cb.multiplierX100 ? cb.multiplierX100 / 100 : null;
  return {
    id: cb.id,
    userId: cb.userId,
    userAddress: (cb.user?.walletAddress ?? "") as Address,
    marketId: cb.requestId ?? cb.id,
    marketLabel: CASINO_GAME_LABEL[cb.game] ?? cb.game,
    marketType: `casino_${cb.game.toLowerCase()}`,
    outcome: 0,
    selectionLabel: multiplier ? `${multiplier.toFixed(2)}×` : "—",
    amount: usdcToString(cb.amount),
    oddsX1000: multiplier ? Math.round(multiplier * 1000) : 0,
    potentialPayout: usdcToString(cb.payout),
    status: casinoStatusToBetStatus(cb.status),
    isLive: false,
    isPublic: false,
    isCasino: true,
    txHash: cb.txHash ?? undefined,
    createdAt: cb.placedAt.toISOString(),
    settledAt: cb.resolvedAt?.toISOString(),
  };
}

export const BetsRepo = {
  async create(input: {
    id: string;
    userId: string;
    marketId: string;
    marketType: string;
    outcome: number;
    selectionLabel: string;
    amount: bigint;
    oddsX1000: number;
    potentialPayout: bigint;
    isLive: boolean;
    isPublic: boolean;
    txHash?: string;
    parlayId?: string;
  }): Promise<BetDTO> {
    const created = await prisma.bet.create({
      data: {
        id: input.id,
        userId: input.userId,
        marketId: input.marketId,
        marketType: input.marketType,
        outcome: input.outcome,
        selectionLabel: input.selectionLabel,
        amount: input.amount,
        oddsX1000: input.oddsX1000,
        potentialPayout: input.potentialPayout,
        isLive: input.isLive,
        isPublic: input.isPublic,
        ...(input.txHash ? { txHash: input.txHash } : {}),
        ...(input.parlayId ? { parlayId: input.parlayId } : {}),
      },
      include: { user: true, market: true },
    });
    return toDto(created);
  },

  async byId(id: string): Promise<BetDTO | null> {
    const b = await prisma.bet.findUnique({ where: { id }, include: { user: true, market: true } });
    return b ? toDto(b) : null;
  },

  async listForUser(userId: string, opts: { status?: BetStatus; limit?: number; offset?: number } = {}) {
    const limit = opts.limit ?? 30;
    const offset = opts.offset ?? 0;
    const where: Prisma.BetWhereInput = { userId, ...(opts.status ? { status: opts.status } : {}) };
    const parlayWhere: Prisma.ParlayWhereInput = { userId, ...(opts.status ? { status: opts.status } : {}) };

    // CasinoBet has its own status enum (see casinoStatusToBetStatus) — no
    // BetStatus maps to CLAIMED (casino payouts settle automatically, no
    // separate claim step), so that filter always excludes casino rows;
    // CANCELLED matches either CANCELLED or REFUNDED since both map to it.
    const casinoStatusFilter =
      opts.status === "CLAIMED" ? null
      : opts.status === "CANCELLED" ? (["CANCELLED", "REFUNDED"] as const)
      : opts.status ? ([opts.status] as const)
      : null;
    const casinoWhere: Prisma.CasinoBetWhereInput = {
      userId,
      ...(casinoStatusFilter ? { status: { in: [...casinoStatusFilter] } } : {}),
    };
    const skipCasino = opts.status === "CLAIMED";

    // Bets, parlays, and casino bets are three separate tables merged into
    // one chronological feed — cross-table pagination isn't a single SQL
    // query, so over-fetch up to `offset + limit` from each side (the true
    // top N can contain at most that many rows from any one source) and
    // merge+slice in memory.
    const fetchCap = offset + limit;
    const [bets, betsTotal, parlays, parlaysTotal, casinoBets, casinoBetsTotal] = await Promise.all([
      prisma.bet.findMany({
        where,
        include: { user: true, market: true },
        orderBy: { placedAt: "desc" },
        take: fetchCap,
      }),
      prisma.bet.count({ where }),
      prisma.parlay.findMany({
        where: parlayWhere,
        include: { user: true, legs: { include: { market: true } } },
        orderBy: { placedAt: "desc" },
        take: fetchCap,
      }),
      prisma.parlay.count({ where: parlayWhere }),
      skipCasino ? [] : prisma.casinoBet.findMany({
        where: casinoWhere,
        include: { user: true },
        orderBy: { placedAt: "desc" },
        take: fetchCap,
      }),
      skipCasino ? 0 : prisma.casinoBet.count({ where: casinoWhere }),
    ]);

    const merged = [...bets.map(toDto), ...parlays.map(parlayToDto), ...casinoBets.map(casinoBetToDto)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);

    return { items: merged, total: betsTotal + parlaysTotal + casinoBetsTotal };
  },

  async publicFeed(limit = 30): Promise<BetDTO[]> {
    const rows = await prisma.bet.findMany({
      where: { isPublic: true },
      include: { user: true, market: true },
      orderBy: { placedAt: "desc" },
      take: limit,
    });
    return rows.map(toDto);
  },

  async setStatus(id: string, status: BetStatus, when = new Date()): Promise<BetDTO | null> {
    const b = await prisma.bet.update({
      where: { id },
      data: {
        status,
        ...(status === "WON" || status === "LOST" || status === "CANCELLED"
          ? { settledAt: when } : {}),
        ...(status === "CLAIMED" ? { claimedAt: when } : {}),
      },
      include: { user: true, market: true },
    });
    return b ? toDto(b) : null;
  },

  /**
   * All PENDING bets on a market, with the fields needed to resolve each
   * one per its own `marketType` — a market row is one fixture/event, but
   * carries bets across every market type offered on it (1X2, totals,
   * BTTS, asian handicap, ...), each with its own winning-outcome logic.
   * See `src/lib/server/settlement.ts`.
   */
  async pendingByMarket(marketId: string) {
    return prisma.bet.findMany({
      where: { marketId, status: "PENDING" },
      select: { id: true, marketType: true, outcome: true, selectionLabel: true, potentialPayout: true },
    });
  },

  /**
   * Reconciles Postgres after an on-chain settlement pass: winningBetIds -> WON,
   * voidedBetIds -> CANCELLED (pushes / unresolvable bets refunded via
   * BettingCore.voidBet, not won or lost), everything else still PENDING on
   * this market -> LOST. Must be called with the exact id sets that were
   * actually submitted on-chain, since this is bookkeeping only — the chain
   * is the source of truth for what was paid.
   */
  async reconcileSettlement(
    marketId: string,
    winningBetIds: string[],
    voidedBetIds: string[] = [],
  ): Promise<{ won: number; voided: number; lost: number }> {
    // Prisma's array-form $transaction requires every element to be a
    // PrismaPromise (not an arbitrary Promise) — an empty `in: []` filter is
    // fine and matches nothing, so this always includes all three updates
    // rather than conditionally swapping one for a plain Promise.resolve().
    const [wonResult, voidedResult, lostResult] = await prisma.$transaction([
      prisma.bet.updateMany({
        where: { id: { in: winningBetIds } },
        data: { status: "WON", settledAt: new Date() },
      }),
      prisma.bet.updateMany({
        where: { id: { in: voidedBetIds } },
        data: { status: "CANCELLED", settledAt: new Date() },
      }),
      prisma.bet.updateMany({
        where: {
          marketId,
          status: "PENDING",
          id: { notIn: [...winningBetIds, ...voidedBetIds] },
        },
        data: { status: "LOST", settledAt: new Date() },
      }),
    ]);
    return { won: wonResult.count, voided: voidedResult.count, lost: lostResult.count };
  },

  async cancelMarketBets(marketId: string) {
    const r = await prisma.bet.updateMany({
      where: { marketId, status: "PENDING" },
      data: { status: "CANCELLED", settledAt: new Date() },
    });
    return r.count;
  },
};
