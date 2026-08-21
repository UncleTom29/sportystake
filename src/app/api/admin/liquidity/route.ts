export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { clientEnv } from "@/lib/env";
import { getOperatorAccount } from "@/lib/server/operatorWallet";
import { erc20Abi } from "../../../../../packages/sdk/src/contracts/abis/ERC20";
import { liquidityPoolAbi } from "../../../../../packages/sdk/src/contracts/abis/LiquidityPool";
import { casinoHouseAbi } from "../../../../../packages/sdk/src/contracts/abis/CasinoHouse";
import { crashGameAbi } from "../../../../../packages/sdk/src/contracts/abis/CrashGame";

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

function formatUsdcNum(raw: bigint): number {
  return Number(raw) / 1_000_000;
}

/**
 * GET /api/admin/liquidity
 * Returns detailed on-chain stats for Sports Pool, Casino House Vault, Crash Game Vault, and Operator Wallet.
 */
export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);

  const operatorAccount = getOperatorAccount("bettingCore");
  const operatorAddress = operatorAccount?.address;

  let operatorGas = 0n;
  let operatorUsdc = 0n;
  let userShares = 0n;
  let userRequestTime = 0n;

  if (operatorAddress) {
    try {
      [operatorGas, operatorUsdc, userShares, userRequestTime] = await Promise.all([
        publicClient.getBalance({ address: operatorAddress }).catch(() => 0n),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [operatorAddress],
        }).catch(() => 0n),
        publicClient.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "shares",
          args: [operatorAddress],
        }).catch(() => 0n),
        publicClient.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "withdrawalRequestTime",
          args: [operatorAddress],
        }).catch(() => 0n),
      ]);
    } catch {}
  }

  // 1. Sports Pool Stats
  const [
    sportsUsdcBalance,
    totalLiquidity,
    totalShares,
    virtualLiquidity,
    lockedForPayouts,
    effectiveCapacity,
    shareValueX1e18,
    onchainTimelock,
  ] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [LIQUIDITY_POOL_ADDRESS],
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "totalLiquidity",
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "totalShares",
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "virtualLiquidity",
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "lockedForPayouts",
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "getEffectiveCapacity",
    }).catch(() => 0n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "getShareValue",
    }).catch(() => 1000000000000000000n),
    publicClient.readContract({
      address: LIQUIDITY_POOL_ADDRESS,
      abi: liquidityPoolAbi,
      functionName: "WITHDRAWAL_TIMELOCK",
    }).catch(() => 172800n),
  ]);

  // 2. Casino House Stats
  const [casinoUsdcBalance, casinoPendingExposure, casinoRtpBps] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [CASINO_HOUSE_ADDRESS],
    }).catch(() => 0n),
    publicClient.readContract({
      address: CASINO_HOUSE_ADDRESS,
      abi: casinoHouseAbi,
      functionName: "totalPendingExposure",
    }).catch(() => 0n),
    publicClient.readContract({
      address: CASINO_HOUSE_ADDRESS,
      abi: casinoHouseAbi,
      functionName: "rtpBps",
    }).catch(() => 9000n),
  ]);

  // 3. Crash Game Stats
  const [crashUsdcBalance, crashPendingPayouts, crashCurrentRoundId, crashRtpBps] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [CRASH_GAME_ADDRESS],
    }).catch(() => 0n),
    publicClient.readContract({
      address: CRASH_GAME_ADDRESS,
      abi: crashGameAbi,
      functionName: "totalPendingPayouts",
    }).catch(() => 0n),
    publicClient.readContract({
      address: CRASH_GAME_ADDRESS,
      abi: crashGameAbi,
      functionName: "currentRoundId",
    }).catch(() => 0n),
    publicClient.readContract({
      address: CRASH_GAME_ADDRESS,
      abi: crashGameAbi,
      functionName: "rtpBps",
    }).catch(() => 9000n),
  ]);

  let crashRoundReserved = 0n;
  if (crashCurrentRoundId > 0n) {
    try {
      const round = await publicClient.readContract({
        address: CRASH_GAME_ADDRESS,
        abi: crashGameAbi,
        functionName: "rounds",
        args: [crashCurrentRoundId],
      });
      // status !== Resolved (2)
      if (round[8] !== 2) {
        crashRoundReserved = round[7];
      }
    } catch {}
  }

  // Computations
  const poolUnlocked: bigint = totalLiquidity > lockedForPayouts ? totalLiquidity - lockedForPayouts : 0n;
  const operatorPositionValue: bigint = (userShares * shareValueX1e18) / 1000000000000000000n;
  const operatorMaxWithdrawable: bigint = operatorPositionValue < poolUnlocked ? operatorPositionValue : poolUnlocked;

  const casinoMaxWithdrawable: bigint = casinoUsdcBalance > casinoPendingExposure ? casinoUsdcBalance - casinoPendingExposure : 0n;
  const crashTotalReserved: bigint = crashPendingPayouts + crashRoundReserved;
  const crashMaxWithdrawable: bigint = crashUsdcBalance > crashTotalReserved ? crashUsdcBalance - crashTotalReserved : 0n;

  const totalProtocolUsdc: bigint = sportsUsdcBalance + casinoUsdcBalance + crashUsdcBalance;

  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  let timelockRemainingSecs = 0;
  let timelockStatus: "none" | "active" | "expired" = "none";

  if (userShares > 0n) {
    if (userRequestTime === 0n) {
      timelockStatus = "none";
    } else {
      const unlockTime = userRequestTime + onchainTimelock;
      if (nowSecs >= unlockTime) {
        timelockStatus = "expired";
      } else {
        timelockStatus = "active";
        timelockRemainingSecs = Number(unlockTime - nowSecs);
      }
    }
  }

  return ok({
    operator: {
      address: operatorAddress || null,
      gasBalance: Number(formatUnits(operatorGas, 18)),
      usdcBalance: formatUsdcNum(operatorUsdc),
    },
    sportsPool: {
      address: LIQUIDITY_POOL_ADDRESS,
      vaultBalance: formatUsdcNum(sportsUsdcBalance),
      tvl: formatUsdcNum(totalLiquidity),
      totalShares: totalShares.toString(),
      virtualLiquidity: formatUsdcNum(virtualLiquidity),
      lockedForPayouts: formatUsdcNum(lockedForPayouts),
      effectiveCapacity: formatUsdcNum(effectiveCapacity),
      unlockedLiquidity: formatUsdcNum(poolUnlocked),
      operatorShares: userShares.toString(),
      operatorPositionValue: formatUsdcNum(operatorPositionValue),
      operatorMaxWithdrawable: formatUsdcNum(operatorMaxWithdrawable),
      timelockSeconds: Number(onchainTimelock),
      timelockStatus,
      timelockRemainingSecs,
    },
    casinoHouse: {
      address: CASINO_HOUSE_ADDRESS,
      vaultBalance: formatUsdcNum(casinoUsdcBalance),
      pendingExposure: formatUsdcNum(casinoPendingExposure),
      maxWithdrawable: formatUsdcNum(casinoMaxWithdrawable),
      rtpPercent: Number(casinoRtpBps) / 100,
    },
    crashGame: {
      address: CRASH_GAME_ADDRESS,
      vaultBalance: formatUsdcNum(crashUsdcBalance),
      pendingPayouts: formatUsdcNum(crashPendingPayouts),
      roundReserved: formatUsdcNum(crashRoundReserved),
      totalReserved: formatUsdcNum(crashTotalReserved),
      maxWithdrawable: formatUsdcNum(crashMaxWithdrawable),
      currentRoundId: Number(crashCurrentRoundId),
      rtpPercent: Number(crashRtpBps) / 100,
    },
    totalProtocolUsdc: formatUsdcNum(totalProtocolUsdc),
  });
});
