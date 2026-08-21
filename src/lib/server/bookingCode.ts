import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/server/db";

const generateCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export interface BookableSelection {
  matchId: string;
  matchLabel: string;
  market: string;
  selection: string;
  odds: number;
  stake?: number;
}

/**
 * Creates a BookedBet record with a unique 6-character alphanumeric code
 * so users can share tickets and other users can load the exact selections.
 */
export async function createBookingCodeForSelections(params: {
  selections: BookableSelection[];
  createdById?: string | null;
}): Promise<string> {
  const totalOdds = Math.max(
    1,
    Math.round(params.selections.reduce((acc, s) => acc * (s.odds > 0 ? s.odds : 1), 1) * 100) / 100,
  );

  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.bookedBet.findUnique({ where: { code } });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  // 14 days expiration
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.bookedBet.create({
    data: {
      code,
      selections: JSON.parse(JSON.stringify(params.selections)),
      totalOdds,
      itemCount: params.selections.length,
      createdById: params.createdById ?? null,
      expiresAt,
    },
  });

  return code;
}
