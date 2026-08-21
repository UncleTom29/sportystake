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

const WithdrawBody = z.object({
  vault: z.enum(["sports", "casino", "crash"]),
  action: z.enum(["request", "execute"]).optional().default("execute"),
  amountUsdc: z.number().positive().optional(),
  recipient: z.string().optional(),
});

/**
 * POST /api/admin/liquidity/withdraw
 * Executes on-chain withdrawals or timelock requests from protocol vaults.
 */
export const POST = withRequestId(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const parsed = WithdrawBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("ValidationError", "Invalid withdrawal parameters", 400, { details: parsed.error.issues });
  }

  const { vault, action, amountUsdc, recipient } = parsed.data;

  const contractName = vault === "sports" ? "liquidityPool" : vault === "casino" ? "casinoHouse" : "crashGame";
  const wallet = getOperatorWallet(contractName) || getOperatorWallet("bettingCore");
  const account = getOperatorAccount(contractName) || getOperatorAccount("bettingCore");

  if (!wallet || !account) {
    return fail("ConfigurationError", "Operator wallet private key is not configured on server", 500);
  }

  const toAddress = (recipient && recipient.startsWith("0x") ? recipient : account.address) as Address;

  let txHash: `0x${string}`;
  let message = "";

  if (vault === "sports") {
    if (action === "request") {
      const userShares = await publicClient.readContract({
        address: LIQUIDITY_POOL_ADDRESS,
        abi: liquidityPoolAbi,
        functionName: "shares",
        args: [account.address],
      });

      if (userShares === 0n) {
        return fail("BadRequest", `Operator wallet owns 0 shares in Sports Pool`, 400);
      }

      txHash = await wallet.writeContract({
        address: LIQUIDITY_POOL_ADDRESS,
        abi: liquidityPoolAbi,
        functionName: "requestWithdrawal",
        chain,
        account,
      });
      message = "Sports pool withdrawal timelock cooldown initiated (48 hours)";
    } else {
      // action === "execute"
      const [userShares, requestTime, timelock, totalLiquidity, lockedForPayouts, shareValue] =
        await Promise.all([
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "shares",
            args: [account.address],
          }),
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "withdrawalRequestTime",
            args: [account.address],
          }),
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "WITHDRAWAL_TIMELOCK",
          }).catch(() => 172800n),
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "totalLiquidity",
          }),
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "lockedForPayouts",
          }),
          publicClient.readContract({
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "getShareValue",
          }),
        ]);

      if (userShares === 0n) {
        return fail("BadRequest", `Operator wallet owns 0 shares in Sports Pool`, 400);
      }

      if (requestTime === 0n) {
        return fail("BadRequest", `No withdrawal has been requested yet. Please initiate cooldown first.`, 400);
      }

      const nowSecs = BigInt(Math.floor(Date.now() / 1000));
      const unlockTime = requestTime + timelock;
      if (nowSecs < unlockTime) {
        const remaining = Number(unlockTime - nowSecs);
        return fail("BadRequest", `Withdrawal timelock is still active (${Math.ceil(remaining / 60)} minutes remaining)`, 400);
      }

      const expectedUsdcOut = (userShares * shareValue) / 1000000000000000000n;
      const unlocked = totalLiquidity > lockedForPayouts ? totalLiquidity - lockedForPayouts : 0n;

      if (expectedUsdcOut > unlocked) {
        return fail("BadRequest", `Insufficient unlocked liquidity in pool (Locked for active bets). Available: $${Number(unlocked)/1_000_000} USDC`, 400);
      }

      txHash = await wallet.writeContract({
        address: LIQUIDITY_POOL_ADDRESS,
        abi: liquidityPoolAbi,
        functionName: "executeWithdrawal",
        chain,
        account,
      });
      message = "LP shares burned and USDC returned to operator wallet successfully";
    }
  } else if (vault === "casino") {
    if (!amountUsdc || amountUsdc <= 0) {
      return fail("BadRequest", "amountUsdc is required for Casino withdrawal", 400);
    }
    const amountRaw = parseUnits(amountUsdc.toString(), 6);

    const [casinoBal, pendingExposure] = await Promise.all([
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [CASINO_HOUSE_ADDRESS],
      }),
      publicClient.readContract({
        address: CASINO_HOUSE_ADDRESS,
        abi: casinoHouseAbi,
        functionName: "totalPendingExposure",
      }),
    ]);

    const maxWithdrawableRaw = casinoBal > pendingExposure ? casinoBal - pendingExposure : 0n;

    if (amountRaw > maxWithdrawableRaw) {
      return fail(
        "BadRequest",
        `Requested withdrawal ($${amountUsdc} USDC) exceeds max withdrawable bankroll ($${Number(maxWithdrawableRaw)/1_000_000} USDC). $${Number(pendingExposure)/1_000_000} USDC is reserved for active bets.`,
        400
      );
    }

    txHash = await wallet.writeContract({
      address: CASINO_HOUSE_ADDRESS,
      abi: casinoHouseAbi,
      functionName: "withdrawBankroll",
      args: [amountRaw, toAddress],
      chain,
      account,
    });
    message = `Withdrawn $${amountUsdc.toLocaleString()} USDC from Casino House to ${toAddress}`;
  } else {
    // vault === "crash"
    if (!amountUsdc || amountUsdc <= 0) {
      return fail("BadRequest", "amountUsdc is required for Crash Game withdrawal", 400);
    }
    const amountRaw = parseUnits(amountUsdc.toString(), 6);

    const [crashBal, pendingPayouts, currentRoundId] = await Promise.all([
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [CRASH_GAME_ADDRESS],
      }),
      publicClient.readContract({
        address: CRASH_GAME_ADDRESS,
        abi: crashGameAbi,
        functionName: "totalPendingPayouts",
      }),
      publicClient.readContract({
        address: CRASH_GAME_ADDRESS,
        abi: crashGameAbi,
        functionName: "currentRoundId",
      }),
    ]);

    let roundReserved = 0n;
    if (currentRoundId > 0n) {
      try {
        const round = await publicClient.readContract({
          address: CRASH_GAME_ADDRESS,
          abi: crashGameAbi,
          functionName: "rounds",
          args: [currentRoundId],
        });
        if (round[8] !== 2) {
          roundReserved = round[7];
        }
      } catch {}
    }

    const totalReserved = pendingPayouts + roundReserved;
    const maxWithdrawableRaw = crashBal > totalReserved ? crashBal - totalReserved : 0n;

    if (amountRaw > maxWithdrawableRaw) {
      return fail(
        "BadRequest",
        `Requested withdrawal ($${amountUsdc} USDC) exceeds max withdrawable bankroll ($${Number(maxWithdrawableRaw)/1_000_000} USDC). $${Number(totalReserved)/1_000_000} USDC is reserved for active players.`,
        400
      );
    }

    txHash = await wallet.writeContract({
      address: CRASH_GAME_ADDRESS,
      abi: crashGameAbi,
      functionName: "withdrawBankroll",
      args: [amountRaw, toAddress],
      chain,
      account,
    });
    message = `Withdrawn $${amountUsdc.toLocaleString()} USDC from Crash Game to ${toAddress}`;
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Record Audit Trail
  await prisma.auditLog.create({
    data: {
      action: "LIQUIDITY_WITHDRAW",
      actorId: admin.id,
      details: {
        vault,
        action,
        amountUsdc: amountUsdc || null,
        recipient: toAddress,
        txHash,
        blockNumber: Number(receipt.blockNumber),
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
    recipient: toAddress,
    message,
  });
});
