/**
 * User repository — read/write helpers for the `User` model.
 * All callers (API routes, workers) should go through here so the DTO shape
 * + ban/active filters live in one place.
 */
import { prisma, type Prisma } from "@/lib/server/db";
import type { UserDTO, UserStats, Address } from "@/lib/types";
import { isKnownAdminAddress } from "@/lib/server/auth";

function toDto(u: {
  id: string;
  walletAddress: string;
  username: string | null;
  avatar?: string | null;
  referralCode: string;
  referredById?: string | null;
  isPublic: boolean;
  isBanned: boolean;
  roles: string[];
  createdAt: Date;
}): UserDTO {
  const rolesSet = new Set(u.roles);
  if (isKnownAdminAddress(u.walletAddress)) {
    rolesSet.add("ADMIN");
    rolesSet.add("OPERATOR");
  }
  return {
    id: u.id,
    walletAddress: u.walletAddress as Address,
    referralCode: u.referralCode,
    referredById: u.referredById ?? undefined,
    isPublic: u.isPublic,
    isBanned: u.isBanned,
    roles: Array.from(rolesSet) as UserDTO["roles"],
    createdAt: u.createdAt.toISOString(),
    username: u.username ?? undefined,
    avatar: u.avatar ?? undefined,
  };
}

export const UsersRepo = {
  async byId(id: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? toDto(u) : null;
  },

  async byAddress(address: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { walletAddress: address.toLowerCase() } });
    return u ? toDto(u) : null;
  },

  async byUsername(username: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { username } });
    return u ? toDto(u) : null;
  },

  async list(opts: { limit?: number; offset?: number } = {}): Promise<{ items: UserDTO[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where, orderBy: { createdAt: "desc" },
        take: opts.limit ?? 50, skip: opts.offset ?? 0,
      }),
      prisma.user.count({ where }),
    ]);
    return { items: items.map(toDto), total };
  },

  async setBanned(id: string, isBanned: boolean, reason?: string): Promise<UserDTO> {
    const u = await prisma.user.update({
      where: { id },
      data: { isBanned, banReason: reason ?? null },
    });
    return toDto(u);
  },

  async setUsername(id: string, username: string): Promise<UserDTO> {
    const u = await prisma.user.update({ where: { id }, data: { username } });
    return toDto(u);
  },

  /** Aggregated stats for a user. Computed from bets and casinoBets tables on demand. */
  async stats(userId: string): Promise<UserStats> {
    const [bets, parlays, casinoBets] = await Promise.all([
      prisma.bet.findMany({
        where: { userId },
        select: {
          amount: true,
          potentialPayout: true,
          status: true,
          placedAt: true,
        },
        orderBy: { placedAt: "asc" },
      }),
      // Parlays live in a separate table from single Bets (see
      // prisma/schema.prisma) — without this, a user who only places
      // parlays sees zeroed-out stats despite having real activity.
      prisma.parlay.findMany({
        where: { userId },
        select: {
          stake: true,
          potentialPayout: true,
          status: true,
          placedAt: true,
        },
        orderBy: { placedAt: "asc" },
      }),
      prisma.casinoBet.findMany({
        where: { userId },
        select: {
          amount: true,
          payout: true,
          status: true,
          placedAt: true,
        },
        orderBy: { placedAt: "asc" },
      }),
    ]);

    let won = 0;
    let lost = 0;
    let wagered = 0n;
    let payout = 0n;
    let currentStreak = 0;
    let bestStreak = 0;

    // Combine all events chronologically
    const allEvents = [
      ...bets.map((b) => ({
        amount: b.amount,
        payout: b.status === "WON" || b.status === "CLAIMED" ? b.potentialPayout : 0n,
        isWin: b.status === "WON" || b.status === "CLAIMED",
        isLoss: b.status === "LOST",
        placedAt: b.placedAt,
      })),
      ...parlays.map((p) => ({
        amount: p.stake,
        payout: p.status === "WON" || p.status === "CLAIMED" ? p.potentialPayout : 0n,
        isWin: p.status === "WON" || p.status === "CLAIMED",
        isLoss: p.status === "LOST",
        placedAt: p.placedAt,
      })),
      ...casinoBets.map((cb) => ({
        amount: cb.amount,
        payout: cb.payout,
        isWin: cb.status === "WON",
        isLoss: cb.status === "LOST",
        placedAt: cb.placedAt,
      })),
    ].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

    for (const e of allEvents) {
      wagered += e.amount;
      if (e.isWin) {
        won++;
        payout += e.payout;
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else if (e.isLoss) {
        lost++;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }
      if (Math.abs(currentStreak) > Math.abs(bestStreak)) bestStreak = currentStreak;
    }

    const totalBets = allEvents.length;
    const winRate = won + lost > 0 ? won / (won + lost) : 0;
    const netPnl = payout - wagered;

    const badges: UserStats["badges"] = [];
    if (currentStreak >= 3) badges.push("HOT_STREAK");
    if (wagered > 5_000_000_000n) badges.push("HIGH_ROLLER"); // > 5,000 USDC
    if (wagered > 50_000_000_000n) badges.push("WHALE");
    if (winRate > 0.6 && totalBets >= 10) badges.push("VALUE_BETTOR");

    return {
      totalBets,
      won,
      lost,
      winRate: Math.round(winRate * 1000) / 1000,
      totalWagered: usdcToString(wagered),
      totalPayout: usdcToString(payout),
      netPnl: usdcToString(netPnl),
      currentStreak,
      bestStreak,
      badges,
    };
  },
};

const ONE_USDC = 1_000_000n;
function usdcToString(n: bigint): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / ONE_USDC;
  const frac = (abs % ONE_USDC).toString().padStart(6, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}
