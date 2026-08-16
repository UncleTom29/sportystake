import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

// In-memory protocol config store (with default fallback values matching smart contracts)
let systemConfig = {
  houseEdgeBps: 200, // 2%
  minBetUsdc: "1.00",
  maxBetUsdc: "5000.00",
  treasuryAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  isPaused: false,
  maxMultipliers: {
    CRASH: 10000, // 100x
    DICE: 9900,   // 99x
    SLOTS: 5000,  // 50x
    BLACKJACK: 300, // 3x
    ROULETTE: 3600, // 36x
    BACCARAT: 900, // 9x
  },
};

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth || (!auth.roles.includes("ADMIN") && !auth.roles.includes("OPERATOR"))) {
    throw new ApiError("Forbidden", "Admin or Operator access required", 403);
  }
  return ok({ config: systemConfig });
});

const UpdateConfigBody = z.object({
  houseEdgeBps: z.number().min(0).max(1000).optional(),
  minBetUsdc: z.string().optional(),
  maxBetUsdc: z.string().optional(),
  treasuryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  isPaused: z.boolean().optional(),
  maxMultipliers: z.record(z.string(), z.number()).optional(),
});

export const POST = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth || !auth.roles.includes("ADMIN")) {
    throw new ApiError("Forbidden", "Admin access required", 403);
  }

  const parsed = UpdateConfigBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid config body", 400, { details: parsed.error.issues });
  }

  systemConfig = {
    ...systemConfig,
    ...parsed.data,
    maxMultipliers: {
      ...systemConfig.maxMultipliers,
      ...(parsed.data.maxMultipliers ?? {}),
    },
  };

  return ok({ config: systemConfig });
});
