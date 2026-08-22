import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
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
    const parlay = await prisma.parlay.findUnique({ where: { id } });
    if (!parlay) throw new ApiError("NotFound", "Parlay not found", 404);
    if (parlay.userId !== auth.sub) throw new ApiError("Forbidden", "Not your parlay", 403);
    if (parlay.status !== "WON") throw new ApiError("Conflict", "Parlay is not in a claimable state", 409);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid body", 400, { details: parsed.error.issues });
    }

    if (parsed.data.direct || !parsed.data.txHash) {
      const operatorWallet = getOperatorWallet("bettingCore");
      if (!operatorWallet) throw new ApiError("Internal", "Operator wallet not configured", 500);

      const txHash = await operatorWallet.writeContract({
        address: clientEnv.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [auth.addr as `0x${string}`, parlay.potentialPayout],
        chain: operatorWallet.chain,
        account: operatorWallet.account!,
      });

      const updated = await prisma.parlay.update({
        where: { id },
        data: {
          status: "CLAIMED",
          settledAt: new Date(),
          txHash,
        },
      });

      return ok({
        parlay: { id: updated.id, status: updated.status, potentialPayout: updated.potentialPayout.toString() },
        payoutUsdc: parlay.potentialPayout.toString(),
        txHash,
      });
    }

    const claim = await verifyClaim(parsed.data.txHash as `0x${string}`, "ParlayWon", auth.addr);
    if (claim.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError("ParlayMismatch", "Transaction claimed a different parlay", 400);
    }

    const updated = await prisma.parlay.update({
      where: { id },
      data: {
        status: "CLAIMED",
        txHash: parsed.data.txHash,
        potentialPayout: claim.amount,
      },
    });

    return ok({
      parlay: { id: updated.id, status: updated.status, potentialPayout: updated.potentialPayout.toString() },
      payoutUsdc: claim.amount.toString(),
      txHash: parsed.data.txHash,
    });
  },
);
