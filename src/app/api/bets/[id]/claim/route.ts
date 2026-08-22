import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { BetsRepo } from "@/lib/server/repos/bets.repo";
import { prisma } from "@/lib/server/db";
import { verifyClaim } from "@/lib/server/betVerification";
import { getOperatorWallet } from "@/lib/server/operatorWallet";
import { clientEnv } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  direct: z.boolean().optional(),
});

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const POST = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth) return fail("Unauthorized", "Sign in", 401);

    const { id } = await ctx.params;
    const betRow = await prisma.bet.findUnique({ where: { id } });
    if (!betRow) throw new ApiError("NotFound", "Bet not found", 404);
    if (betRow.userId !== auth.sub) throw new ApiError("Forbidden", "Not your bet", 403);
    if (betRow.status !== "WON") throw new ApiError("Conflict", "Bet is not in a claimable state", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    if (parsed.data.direct || !parsed.data.txHash) {
      // Server-assisted direct payout using operator wallet
      const operatorWallet = getOperatorWallet("bettingCore");
      if (!operatorWallet) throw new ApiError("Internal", "Operator wallet not configured", 500);

      const txHash = await operatorWallet.writeContract({
        address: clientEnv.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [auth.addr as `0x${string}`, betRow.potentialPayout],
        chain: operatorWallet.chain,
        account: operatorWallet.account!,
      });

      await prisma.bet.update({
        where: { id },
        data: {
          status: "CLAIMED",
          claimedAt: new Date(),
          txHash,
        },
      });

      const updated = await BetsRepo.byId(id);
      return ok({ bet: updated, payoutUsdc: betRow.potentialPayout.toString(), txHash });
    }

    const claim = await verifyClaim(parsed.data.txHash as `0x${string}`, "WinningsClaimed", auth.addr);
    if (claim.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("BetMismatch", "Transaction claimed a different bet", 400);
    }

    await prisma.bet.update({
      where: { id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        txHash: parsed.data.txHash,
        potentialPayout: claim.amount,
      },
    });
    const updated = await BetsRepo.byId(id);

    return ok({ bet: updated, payoutUsdc: claim.amount.toString(), txHash: parsed.data.txHash });
  },
);
