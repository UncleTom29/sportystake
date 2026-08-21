export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createPublicClient, http, parseUnits, type Address } from "viem";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { clientEnv } from "@/lib/env";
import { getOperatorAccount, getOperatorWallet } from "@/lib/server/operatorWallet";
import { prisma } from "@/lib/server/db";
import { erc20Abi } from "../../../../../../packages/sdk/src/contracts/abis/ERC20";
import { liquidityPoolAbi } from "../../../../../../packages/sdk/src/contracts/abis/LiquidityPool";
import { casinoHouseAbi } from "../../../../../../packages/sdk/src/contracts/abis/CasinoHouse";
import { crashGameAbi } from "../../../../../../packages/sdk/src/contracts/abis/CrashGame";

export const runtime = "nodejs";

const chain = {
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: "arc",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [clientEnv.NEXT_PUBLIC_RPC_URL] } },
} as const;

const publicClient = createPublicClient({
  chain,
  transport: http(clientEnv.NEXT_PUBLIC_RPC_URL),
});

const USDC_ADDRESS = clientEnv.NEXT_PUBLIC_USDC_ADDRESS as Address;
const LIQUIDITY_POOL_ADDRESS = clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS as Address;
const CASINO_HOUSE_ADDRESS = clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS as Address;
const CRASH_GAME_ADDRESS = (process.env.NEXT_PUBLIC_CRASH_GAME_ADDRESS || "0xa7FF5FB348FeEfEf4C092CD67AE62344A33Be8A0") as Address;

const DepositBody = z.object({
  vault: z.enum(["sports", "casino", "crash"]),
  amountUsdc: z.number().positive(),
});

/**
 * POST /api/admin/liquidity/deposit
 * Injects on-chain USDC liquidity into the chosen protocol vault using the operator key.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const parsed = DepositBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid deposit parameters", 400, { details: parsed.error.issues });
  }

  const { vault, amountUsdc } = parsed.data;
  const amountRaw = parseUnits(amountUsdc.toString(), 6);

  const contractName = vault === "sports" ? "liquidityPool" : vault === "casino" ? "casinoHouse" : "crashGame";
  const wallet = getOperatorWallet(contractName) || getOperatorWallet("bettingCore");
  const account = getOperatorAccount(contractName) || getOperatorAccount("bettingCore");

  if (!wallet || !account) {
    return fail("ConfigurationError", "Operator wallet private key is not configured on server", 500);
  }

  const targetAddress =
    vault === "sports"
      ? LIQUIDITY_POOL_ADDRESS
      : vault === "casino"
      ? CASINO_HOUSE_ADDRESS
      : CRASH_GAME_ADDRESS;

  // 1. Ensure USDC Allowance
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, targetAddress],
  });

  if (allowance < amountRaw) {
    const approveTx = await wallet.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [targetAddress, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
      chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // 2. Execute Deposit
  let txHash: `0x${string}`;

  if (vault === "sports") {
    txHash = await wallet.writeContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "deposit",
      args: [amountRaw],
      chain,
      account,
    });
  } else if (vault === "casino") {
    txHash = await wallet.writeContract({
      address: CASINO_HOUSE_ADDRESS,
      abi: casinoHouseAbi,
      functionName: "depositBankroll",
      args: [amountRaw],
      chain,
      account,
    });
  } else {
    txHash = await wallet.writeContract({
      address: CRASH_GAME_ADDRESS,
      abi: crashGameAbi,
      functionName: "depositBankroll",
      args: [amountRaw],
      chain,
      account,
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // 3. Record Audit Trail
  await prisma.auditLog.create({
    data: {
      action: "LIQUIDITY_DEPOSIT",
      actorId: admin.id,
      details: {
        vault,
        amountUsdc,
        txHash,
        blockNumber: Number(receipt.blockNumber),
        targetAddress,
        operator: account.address,
      },
    },
  }).catch(() => {});

  return ok({
    success: true,
    txHash,
    blockNumber: Number(receipt.blockNumber),
    vault,
    amountUsdc,
    message: `Successfully deposited $${amountUsdc.toLocaleString()} USDC to ${vault.toUpperCase()} vault`,
  });
});
