import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { customAlphabet } from "nanoid";

export const runtime = "nodejs";

const generateCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

const BetSelectionSchema = z.object({
  matchId: z.string(),
  matchLabel: z.string(),
  market: z.string(),
  selection: z.string(),
  odds: z.number().positive(),
  stake: z.number().optional(),
});

const BookBetBody = z.object({
  selections: z.array(BetSelectionSchema).min(1, "At least 1 selection is required"),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  const parsed = BookBetBody.safeParse(await req.json().catch(() => ({})));
  
  if (!parsed.success) {
    return fail("ValidationError", "Invalid selections", 400, { details: parsed.error.issues });
  }

  const { selections } = parsed.data;

  // Calculate combined odds
  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const formattedOdds = Math.round(totalOdds * 100) / 100;

  // Generate unique booking code e.g. 7X9K2W
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.bookedBet.findUnique({ where: { code } });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  // Set expiration to 7 days from creation
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const booked = await prisma.bookedBet.create({
    data: {
      code,
      selections: JSON.parse(JSON.stringify(selections)),
      totalOdds: formattedOdds,
      itemCount: selections.length,
      createdById: auth?.sub ?? null,
      expiresAt,
    },
  });

  return ok({
    code: booked.code,
    totalOdds: booked.totalOdds,
    itemCount: booked.itemCount,
    selections: booked.selections,
    createdAt: booked.createdAt.toISOString(),
    expiresAt: booked.expiresAt.toISOString(),
  });
});
