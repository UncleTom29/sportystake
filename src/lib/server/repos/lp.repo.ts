/**
 * LP position repository. One shared, protocol-wide LiquidityPool contract
 * backs every market — a position is per-user, not per-market.
 */
import { prisma } from "@/lib/server/db";
import type { LPPositionDTO, LPStatus, Address } from "@/lib/types";
import { usdcToString } from "./bets.repo";

type LpRow = Awaited<ReturnType<typeof prisma.lpPosition.findFirst>> & {
  user?: { walletAddress: string } | null;
};

function toDto(p: NonNullable<LpRow>): LPPositionDTO {
  return {
    id: p.id,
    userId: p.userId,
    userAddress: (p.user?.walletAddress ?? "") as Address,
    onchainShares: p.onchainShares.toString(),
    depositedUsdc: usdcToString(p.depositedUsdc),
    currentValueUsdc: usdcToString(p.currentValueUsdc),
    status: p.status as LPStatus,
    txHash: p.depositTxHash ?? "",
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const LpRepo = {
  /** Create the caller's position, or top it up if one already exists. */
  async upsert(input: {
    userId: string;
    onchainShares: bigint;
    depositedUsdc: bigint;
    depositTxHash?: string;
  }): Promise<LPPositionDTO> {
    const row = await prisma.lpPosition.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        onchainShares: input.onchainShares,
        depositedUsdc: input.depositedUsdc,
        currentValueUsdc: input.depositedUsdc,
        ...(input.depositTxHash ? { depositTxHash: input.depositTxHash } : {}),
      },
      update: {
        onchainShares: { increment: input.onchainShares },
        depositedUsdc: { increment: input.depositedUsdc },
        currentValueUsdc: { increment: input.depositedUsdc },
        status: "ACTIVE",
        ...(input.depositTxHash ? { depositTxHash: input.depositTxHash } : {}),
      },
      include: { user: true },
    });
    return toDto(row);
  },

  async byId(id: string): Promise<LPPositionDTO | null> {
    const p = await prisma.lpPosition.findUnique({
      where: { id },
      include: { user: true },
    });
    return p ? toDto(p) : null;
  },

  async forUser(userId: string): Promise<LPPositionDTO | null> {
    const p = await prisma.lpPosition.findUnique({
      where: { userId },
      include: { user: true },
    });
    return p ? toDto(p) : null;
  },

  async requestWithdraw(id: string): Promise<LPPositionDTO> {
    const p = await prisma.lpPosition.update({
      where: { id },
      data: {
        status: "WITHDRAW_REQUESTED",
        withdrawalRequestedAt: new Date(),
      },
      include: { user: true },
    });
    return toDto(p);
  },

  async executeWithdraw(id: string, txHash?: string): Promise<LPPositionDTO> {
    const p = await prisma.lpPosition.update({
      where: { id },
      data: {
        status: "WITHDRAWN",
        onchainShares: 0n,
        currentValueUsdc: 0n,
        ...(txHash ? { withdrawTxHash: txHash } : {}),
      },
      include: { user: true },
    });
    return toDto(p);
  },

  /**
   * Refresh `onchainShares`/`currentValueUsdc` from a live on-chain read
   * (LiquidityPool.getUserPosition). Called on-demand — e.g. when the
   * wallet page loads — since the shared pool's share price moves
   * continuously as markets settle, not at one freeze point per market.
   */
  async syncFromChain(userId: string, onchain: { shares: bigint; usdcValue: bigint }): Promise<LPPositionDTO | null> {
    const existing = await prisma.lpPosition.findUnique({ where: { userId } });
    if (!existing) return null;
    const p = await prisma.lpPosition.update({
      where: { userId },
      data: {
        onchainShares: onchain.shares,
        currentValueUsdc: onchain.usdcValue,
      },
      include: { user: true },
    });
    return toDto(p);
  },
};
