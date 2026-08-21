/**
 * SportyStake Protocol On-Chain Liquidity Management CLI
 *
 * Check, fund, and manage liquidity for:
 * 1. Core Sports Betting Pool (LiquidityPool.sol)
 * 2. Casino House Vault (CasinoHouse.sol)
 * 3. Crash Game Vault (CrashGame.sol)
 *
 * Directly on-chain on Arc Network.
 *
 * Usage:
 *   # Check all on-chain vaults, balances, max withdrawable figures, and timelocks
 *   npx tsx scripts/manage-liquidity.ts check
 *
 *   # Sports Pool (LiquidityPool.sol)
 *   npx tsx scripts/manage-liquidity.ts add-core <amountUSDC>
 *   npx tsx scripts/manage-liquidity.ts request-withdraw-core
 *   npx tsx scripts/manage-liquidity.ts withdraw-core
 *
 *   # Casino House Bankroll (CasinoHouse.sol)
 *   npx tsx scripts/manage-liquidity.ts add-casino <amountUSDC>
 *   npx tsx scripts/manage-liquidity.ts withdraw-casino <amountUSDC> [recipientAddress]
 *
 *   # Crash Game Bankroll (CrashGame.sol)
 *   npx tsx scripts/manage-liquidity.ts add-crash <amountUSDC>
 *   npx tsx scripts/manage-liquidity.ts withdraw-crash <amountUSDC> [recipientAddress]
 *
 *   # Unified Funding & Virtual Controls
 *   npx tsx scripts/manage-liquidity.ts add-all <amountUSDC>
 *   npx tsx scripts/manage-liquidity.ts add-virtual <amountUSDC>
 */

import fs from "fs";
try {
  if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch {}
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  formatUnits,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "../packages/sdk/src/contracts/abis/ERC20";
import { liquidityPoolAbi } from "../packages/sdk/src/contracts/abis/LiquidityPool";
import { casinoHouseAbi } from "../packages/sdk/src/contracts/abis/CasinoHouse";
import { crashGameAbi } from "../packages/sdk/src/contracts/abis/CrashGame";

// Load configuration from environment
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://arc-testnet.drpc.org";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "5042002");

const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "Native Gas", symbol: "GAS", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000") as Address;
const LIQUIDITY_POOL_ADDRESS = (process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || "0x574DF566b98E6f3Cb7459b39BFD9afeD8694A154") as Address;
const CASINO_HOUSE_ADDRESS = (process.env.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS || "0x615f95fa5ccCe9Cd79d7aBc0e37983aaDD9f9b9d") as Address;
const CRASH_GAME_ADDRESS = (process.env.NEXT_PUBLIC_CRASH_GAME_ADDRESS || "0xa7FF5FB348FeEfEf4C092CD67AE62344A33Be8A0") as Address;

const RAW_KEY =
  process.env.OPERATOR_PRIVATE_KEY ||
  process.env.ADMIN_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.ORACLE_ATTESTATION_PRIVATE_KEY ||
  process.env.PRIVATE_KEY;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
});

function getWallet() {
  if (!RAW_KEY) {
    throw new Error(
      "No operator/admin private key found in environment (.env). Please set OPERATOR_PRIVATE_KEY or PRIVATE_KEY."
    );
  }
  const formattedKey = (RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(RPC_URL),
  });
  return { account, walletClient };
}

function formatUsdc(raw: bigint): string {
  return (Number(raw) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ready to execute now";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

/**
 * Check on-chain liquidity for Sports Pool, Casino House, and Crash Game
 */
async function checkLiquidity() {
  console.log("\n===================================================================");
  console.log("             SPORTYSTAKE PROTOCOL ON-CHAIN LIQUIDITY              ");
  console.log("===================================================================");
  console.log(`RPC Endpoint:   ${RPC_URL}`);
  console.log(`Chain ID:       ${CHAIN_ID}`);
  console.log(`USDC Contract:  ${USDC_ADDRESS}`);
  console.log(`Sports Pool:    ${LIQUIDITY_POOL_ADDRESS}`);
  console.log(`Casino House:   ${CASINO_HOUSE_ADDRESS}`);
  console.log(`Crash Game:     ${CRASH_GAME_ADDRESS}`);
  console.log("-------------------------------------------------------------------");

  let operatorAddr = "N/A";
  let operatorGas = 0n;
  let operatorUsdc = 0n;
  let userShares = 0n;
  let userRequestTime = 0n;
  let timelockSeconds = 172800n; // 48h default

  if (RAW_KEY) {
    try {
      const { account } = getWallet();
      operatorAddr = account.address;
      [operatorGas, operatorUsdc, userShares, userRequestTime] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account.address],
        }),
        publicClient.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "shares",
          args: [account.address],
        }).catch(() => 0n),
        publicClient.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "withdrawalRequestTime",
          args: [account.address],
        }).catch(() => 0n),
      ]);
    } catch {}
  }

  // Sports Pool stats
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

  timelockSeconds = onchainTimelock;

  // Casino House stats
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
    }).catch(() => 9700n),
  ]);

  // Crash Game stats
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
    }).catch(() => 9700n),
  ]);

  // Crash active round exposure
  let crashRoundReserved = 0n;
  if (crashCurrentRoundId > 0n) {
    try {
      const round = await publicClient.readContract({
        address: CRASH_GAME_ADDRESS,
        abi: crashGameAbi,
        functionName: "rounds",
        args: [crashCurrentRoundId],
      });
      // status 2 = Resolved
      if (round[8] !== 2) {
        crashRoundReserved = round[7]; // maxPotentialPayout
      }
    } catch {}
  }

  const crashTotalReserved = crashPendingPayouts + crashRoundReserved;
  const crashMaxWithdrawable = crashUsdcBalance > crashTotalReserved ? crashUsdcBalance - crashTotalReserved : 0n;

  // Calculations for Sports Pool
  const poolUnlockedLiquidity = totalLiquidity > lockedForPayouts ? totalLiquidity - lockedForPayouts : 0n;
  const userPositionValue = (userShares * shareValueX1e18) / 1000000000000000000n;
  const userMaxWithdrawable = userPositionValue < poolUnlockedLiquidity ? userPositionValue : poolUnlockedLiquidity;

  // Calculations for Casino House
  const casinoMaxWithdrawable = casinoUsdcBalance > casinoPendingExposure ? casinoUsdcBalance - casinoPendingExposure : 0n;

  console.log(`\n💼 OPERATOR / ADMIN WALLET:`);
  console.log(`   Address:                ${operatorAddr}`);
  console.log(`   Gas Token Balance:      ${formatUnits(operatorGas, 18)} Native Gas`);
  console.log(`   USDC Wallet Balance:    $${formatUsdc(operatorUsdc)} USDC`);

  if (RAW_KEY) {
    console.log(`\n👤 OPERATOR SPORTS POOL LP POSITION:`);
    console.log(`   LP Shares Owned:        ${userShares.toString()} shares`);
    console.log(`   Current LP Position:    $${formatUsdc(userPositionValue)} USDC`);
    console.log(`   Max Withdrawable:       $${formatUsdc(userMaxWithdrawable)} USDC`);

    if (userShares > 0n) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (userRequestTime === 0n) {
        console.log(`   Withdrawal Status:      ⚪ Not requested (Run "manage-liquidity.ts request-withdraw-core" to begin 48h cooldown)`);
      } else {
        const unlockTime = userRequestTime + timelockSeconds;
        if (now >= unlockTime) {
          console.log(`   Withdrawal Status:      🟢 TIMELOCK EXPIRED — Ready to execute! (Run "manage-liquidity.ts withdraw-core")`);
        } else {
          const remainingSecs = Number(unlockTime - now);
          console.log(`   Withdrawal Status:      ⏳ Timelock active (${formatTimeRemaining(remainingSecs)} remaining until unlock)`);
        }
      }
    }
  }

  console.log(`\n⚽ CORE SPORTS BETTING POOL (${LIQUIDITY_POOL_ADDRESS}):`);
  console.log(`   Contract USDC Vault:    $${formatUsdc(sportsUsdcBalance)} USDC`);
  console.log(`   Real Deposited TVL:     $${formatUsdc(totalLiquidity)} USDC`);
  console.log(`   Virtual Credit:         $${formatUsdc(virtualLiquidity)} USDC`);
  console.log(`   Locked for Open Bets:   $${formatUsdc(lockedForPayouts)} USDC`);
  console.log(`   Protocol Free (Max LP): $${formatUsdc(poolUnlockedLiquidity)} USDC (Total TVL minus open bets)`);
  console.log(`   Effective Capacity:     $${formatUsdc(effectiveCapacity)} USDC`);

  console.log(`\n🎰 CASINO HOUSE VAULT (${CASINO_HOUSE_ADDRESS}):`);
  console.log(`   Bankroll Vault USDC:    $${formatUsdc(casinoUsdcBalance)} USDC`);
  console.log(`   Pending Game Exposure:  $${formatUsdc(casinoPendingExposure)} USDC`);
  console.log(`   Max Withdrawable Admin: $${formatUsdc(casinoMaxWithdrawable)} USDC (Vault balance minus pending bets)`);
  console.log(`   House RTP Setting:      ${(Number(casinoRtpBps) / 100).toFixed(2)}% RTP (${(100 - Number(casinoRtpBps) / 100).toFixed(2)}% House Edge)`);

  console.log(`\n🚀 CRASH GAME VAULT (${CRASH_GAME_ADDRESS}):`);
  console.log(`   Bankroll Vault USDC:    $${formatUsdc(crashUsdcBalance)} USDC`);
  console.log(`   Pending / Round Reserved: $${formatUsdc(crashTotalReserved)} USDC`);
  console.log(`   Max Withdrawable Admin: $${formatUsdc(crashMaxWithdrawable)} USDC (Vault balance minus active rounds)`);
  console.log(`   Current Round ID:       #${crashCurrentRoundId.toString()}`);
  console.log(`   House RTP Setting:      ${(Number(crashRtpBps) / 100).toFixed(2)}% RTP (${(100 - Number(crashRtpBps) / 100).toFixed(2)}% House Edge)`);

  const combinedReal = sportsUsdcBalance + casinoUsdcBalance + crashUsdcBalance;
  console.log("\n-------------------------------------------------------------------");
  console.log(`🏛️  TOTAL PROTOCOL ON-CHAIN USDC LIQUIDITY: $${formatUsdc(combinedReal)} USDC`);
  console.log("===================================================================\n");
}

/**
 * Approve token allowance if current allowance is below required amount
 */
async function ensureAllowance(spender: Address, amountRaw: bigint) {
  const { account, walletClient } = getWallet();
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (allowance < amountRaw) {
    console.log(`⏳ Approving USDC for ${spender}...`);
    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
    });
    console.log(`   Tx Submitted: ${txHash}`);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`✅ USDC Approved successfully.`);
  }
}

/**
 * Add liquidity to Core Sports Betting Pool (LiquidityPool.sol)
 */
async function addCoreLiquidity(amountUsdc: number) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();

  console.log(`\n🚀 Adding $${amountUsdc} USDC to Core Sports Betting Pool...`);
  console.log(`   Wallet:    ${account.address}`);
  console.log(`   Pool:      ${LIQUIDITY_POOL_ADDRESS}`);

  await ensureAllowance(LIQUIDITY_POOL_ADDRESS, amountRaw);

  console.log(`⏳ Calling LiquidityPool.deposit(${amountRaw})...`);
  const txHash = await walletClient.writeContract({
    address: LIQUIDITY_POOL_ADDRESS,
    abi: liquidityPoolAbi,
    functionName: "deposit",
    args: [amountRaw],
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Liquidity added to Sports Pool successfully in block ${receipt.blockNumber}!\n`);

  await checkLiquidity();
}

/**
 * Request LP withdrawal from Sports Pool (Starts 48h timelock)
 */
async function requestWithdrawCore() {
  const { account, walletClient } = getWallet();
  const [userShares, currentRequestTime, timelock] = await Promise.all([
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
  ]);

  if (userShares === 0n) {
    throw new Error(`Wallet ${account.address} owns 0 LP shares in the Sports Pool.`);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  if (currentRequestTime > 0n) {
    const unlockTime = currentRequestTime + timelock;
    if (now < unlockTime) {
      const remaining = Number(unlockTime - now);
      console.log(`\n⏳ A withdrawal request is already pending for ${account.address}.`);
      console.log(`   Time remaining until unlock: ${formatTimeRemaining(remaining)}`);
      return;
    } else {
      console.log(`\n🟢 Timelock already expired! You can directly run: "npx tsx scripts/manage-liquidity.ts withdraw-core"`);
      return;
    }
  }

  console.log(`\n⏳ Requesting LP withdrawal for ${account.address} (${userShares.toString()} shares)...`);
  console.log(`   Note: This starts the on-chain ${Number(timelock) / 3600}h cooldown period.`);

  const txHash = await walletClient.writeContract({
    address: LIQUIDITY_POOL_ADDRESS,
    abi: liquidityPoolAbi,
    functionName: "requestWithdrawal",
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Withdrawal request confirmed in block ${receipt.blockNumber}!`);
  console.log(`   Cooldown started. You can execute the withdrawal in ${Number(timelock) / 3600} hours.\n`);

  await checkLiquidity();
}

/**
 * Execute LP withdrawal from Sports Pool
 */
async function executeWithdrawCore() {
  const { account, walletClient } = getWallet();
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
    throw new Error(`Wallet ${account.address} owns 0 LP shares in the Sports Pool.`);
  }

  if (requestTime === 0n) {
    throw new Error(
      `No withdrawal has been requested yet. Please run "npx tsx scripts/manage-liquidity.ts request-withdraw-core" first.`
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const unlockTime = requestTime + timelock;

  if (now < unlockTime) {
    const remaining = Number(unlockTime - now);
    throw new Error(
      `Withdrawal timelock is still active. Remaining: ${formatTimeRemaining(remaining)}. Cannot execute yet.`
    );
  }

  const expectedUsdcOut = (userShares * shareValue) / 1000000000000000000n;
  const unlocked = totalLiquidity > lockedForPayouts ? totalLiquidity - lockedForPayouts : 0n;

  console.log(`\n💸 Executing LP Withdrawal from Sports Pool...`);
  console.log(`   Wallet:            ${account.address}`);
  console.log(`   Shares to burn:    ${userShares.toString()}`);
  console.log(`   Expected payout:   $${formatUsdc(expectedUsdcOut)} USDC`);
  console.log(`   Pool Unlocked:     $${formatUsdc(unlocked)} USDC`);

  if (expectedUsdcOut > unlocked) {
    throw new Error(
      `Insufficient unlocked pool liquidity. Required: $${formatUsdc(expectedUsdcOut)} USDC, Available: $${formatUsdc(unlocked)} USDC. Wait for active match payouts to settle.`
    );
  }

  console.log(`⏳ Calling LiquidityPool.executeWithdrawal()...`);
  const txHash = await walletClient.writeContract({
    address: LIQUIDITY_POOL_ADDRESS,
    abi: liquidityPoolAbi,
    functionName: "executeWithdrawal",
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Withdrawal executed successfully in block ${receipt.blockNumber}! USDC received in wallet.\n`);

  await checkLiquidity();
}

/**
 * Add liquidity to Casino House Bankroll
 */
async function addCasinoLiquidity(amountUsdc: number) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();

  console.log(`\n🎰 Adding $${amountUsdc} USDC to Casino House Bankroll Vault...`);
  console.log(`   Wallet:    ${account.address}`);
  console.log(`   Casino:    ${CASINO_HOUSE_ADDRESS}`);

  // Pre-flight ADMIN_ROLE check
  const ADMIN_ROLE_HASH = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as `0x${string}`;
  const hasAdmin = await publicClient.readContract({
    address: CASINO_HOUSE_ADDRESS,
    abi: [
      {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ],
    functionName: "hasRole",
    args: [ADMIN_ROLE_HASH, account.address],
  });

  if (!hasAdmin) {
    throw new Error(
      `Wallet ${account.address} does not hold ADMIN_ROLE on CasinoHouse contract (${CASINO_HOUSE_ADDRESS}). Only designated protocol admin accounts can deposit or withdraw casino bankroll.`
    );
  }

  await ensureAllowance(CASINO_HOUSE_ADDRESS, amountRaw);

  console.log(`⏳ Calling CasinoHouse.depositBankroll(${amountRaw})...`);
  const txHash = await walletClient.writeContract({
    address: CASINO_HOUSE_ADDRESS,
    abi: casinoHouseAbi,
    functionName: "depositBankroll",
    args: [amountRaw],
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Bankroll added to Casino House successfully in block ${receipt.blockNumber}!\n`);

  await checkLiquidity();
}

/**
 * Withdraw bankroll from Casino House (Checks maximum withdrawable amount)
 */
async function withdrawCasinoLiquidity(amountUsdc: number, recipient?: string) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();
  const toAddress = (recipient || account.address) as Address;

  // Pre-flight ADMIN_ROLE check
  const ADMIN_ROLE_HASH = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as `0x${string}`;
  const hasAdmin = await publicClient.readContract({
    address: CASINO_HOUSE_ADDRESS,
    abi: [
      {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ],
    functionName: "hasRole",
    args: [ADMIN_ROLE_HASH, account.address],
  });

  if (!hasAdmin) {
    throw new Error(
      `Wallet ${account.address} does not hold ADMIN_ROLE on CasinoHouse contract (${CASINO_HOUSE_ADDRESS}). Only designated protocol admin accounts can deposit or withdraw casino bankroll.`
    );
  }

  // Check maximum withdrawable
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

  console.log(`\n💸 Withdrawing $${amountUsdc} USDC from Casino House Vault...`);
  console.log(`   Recipient:             ${toAddress}`);
  console.log(`   Vault Balance:         $${formatUsdc(casinoBal)} USDC`);
  console.log(`   Pending Game Exposure: $${formatUsdc(pendingExposure)} USDC`);
  console.log(`   Max Withdrawable:      $${formatUsdc(maxWithdrawableRaw)} USDC`);

  if (amountRaw > maxWithdrawableRaw) {
    throw new Error(
      `Requested withdrawal ($${amountUsdc} USDC) exceeds max withdrawable bankroll ($${formatUsdc(maxWithdrawableRaw)} USDC). $${formatUsdc(pendingExposure)} USDC is reserved for active wagers.`
    );
  }

  console.log(`⏳ Calling CasinoHouse.withdrawBankroll(${amountRaw}, ${toAddress})...`);
  const txHash = await walletClient.writeContract({
    address: CASINO_HOUSE_ADDRESS,
    abi: casinoHouseAbi,
    functionName: "withdrawBankroll",
    args: [amountRaw, toAddress],
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Withdrawn $${amountUsdc} USDC to ${toAddress} in block ${receipt.blockNumber}!\n`);

  await checkLiquidity();
}

/**
 * Add liquidity to Crash Game Bankroll
 */
async function addCrashLiquidity(amountUsdc: number) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();

  console.log(`\n🚀 Adding $${amountUsdc} USDC to Crash Game Bankroll Vault...`);
  console.log(`   Wallet:    ${account.address}`);
  console.log(`   Crash:     ${CRASH_GAME_ADDRESS}`);

  // Pre-flight ADMIN_ROLE check
  const adminRole = await publicClient.readContract({
    address: CRASH_GAME_ADDRESS,
    abi: crashGameAbi,
    functionName: "ADMIN_ROLE",
  });
  const hasAdmin = await publicClient.readContract({
    address: CRASH_GAME_ADDRESS,
    abi: [
      {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ],
    functionName: "hasRole",
    args: [adminRole, account.address],
  });

  if (!hasAdmin) {
    throw new Error(
      `Wallet ${account.address} does not hold ADMIN_ROLE on CrashGame contract (${CRASH_GAME_ADDRESS}). Only designated protocol admin accounts can deposit or withdraw crash bankroll.`
    );
  }

  await ensureAllowance(CRASH_GAME_ADDRESS, amountRaw);

  console.log(`⏳ Calling CrashGame.depositBankroll(${amountRaw})...`);
  const txHash = await walletClient.writeContract({
    address: CRASH_GAME_ADDRESS,
    abi: crashGameAbi,
    functionName: "depositBankroll",
    args: [amountRaw],
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Bankroll added to Crash Game successfully in block ${receipt.blockNumber}!\n`);

  await checkLiquidity();
}

/**
 * Withdraw bankroll from Crash Game (Checks maximum withdrawable amount)
 */
async function withdrawCrashLiquidity(amountUsdc: number, recipient?: string) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();
  const toAddress = (recipient || account.address) as Address;

  // Pre-flight ADMIN_ROLE check
  const adminRole = await publicClient.readContract({
    address: CRASH_GAME_ADDRESS,
    abi: crashGameAbi,
    functionName: "ADMIN_ROLE",
  });
  const hasAdmin = await publicClient.readContract({
    address: CRASH_GAME_ADDRESS,
    abi: [
      {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ],
    functionName: "hasRole",
    args: [adminRole, account.address],
  });

  if (!hasAdmin) {
    throw new Error(
      `Wallet ${account.address} does not hold ADMIN_ROLE on CrashGame contract (${CRASH_GAME_ADDRESS}). Only designated protocol admin accounts can deposit or withdraw crash bankroll.`
    );
  }

  // Check maximum withdrawable
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

  console.log(`\n💸 Withdrawing $${amountUsdc} USDC from Crash Game Vault...`);
  console.log(`   Recipient:             ${toAddress}`);
  console.log(`   Vault Balance:         $${formatUsdc(crashBal)} USDC`);
  console.log(`   Pending & Round Res.:  $${formatUsdc(totalReserved)} USDC`);
  console.log(`   Max Withdrawable:      $${formatUsdc(maxWithdrawableRaw)} USDC`);

  if (amountRaw > maxWithdrawableRaw) {
    throw new Error(
      `Requested withdrawal ($${amountUsdc} USDC) exceeds max withdrawable bankroll ($${formatUsdc(maxWithdrawableRaw)} USDC). $${formatUsdc(totalReserved)} USDC is reserved for active player payouts.`
    );
  }

  console.log(`⏳ Calling CrashGame.withdrawBankroll(${amountRaw}, ${toAddress})...`);
  const txHash = await walletClient.writeContract({
    address: CRASH_GAME_ADDRESS,
    abi: crashGameAbi,
    functionName: "withdrawBankroll",
    args: [amountRaw, toAddress],
  });

  console.log(`   Tx Hash: ${txHash}`);
  console.log(`⏳ Waiting for block confirmation on Arc Network...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Withdrawn $${amountUsdc} USDC to ${toAddress} in block ${receipt.blockNumber}!\n`);

  await checkLiquidity();
}

/**
 * Add virtual liquidity credit to Core Pool
 */
async function addVirtualCredit(amountUsdc: number) {
  if (amountUsdc <= 0) throw new Error("Amount must be greater than 0");
  const amountRaw = parseUnits(amountUsdc.toString(), 6);
  const { account, walletClient } = getWallet();

  console.log(`\n🛡️ Adding $${amountUsdc} USDC Virtual Liquidity Credit to Sports Pool...`);
  const txHash = await walletClient.writeContract({
    address: LIQUIDITY_POOL_ADDRESS,
    abi: liquidityPoolAbi,
    functionName: "addVirtualLiquidity",
    args: [amountRaw],
  });

  console.log(`   Tx Hash: ${txHash}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`✅ Virtual liquidity credit added!\n`);

  await checkLiquidity();
}

async function main() {
  const command = (process.argv[2] || "check").toLowerCase();
  const amountArg = process.argv[3];
  const recipientArg = process.argv[4];

  switch (command) {
    case "check":
    case "status":
    case "info":
      await checkLiquidity();
      break;

    case "add-core":
    case "add-sports":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts add-core 500");
        process.exit(1);
      }
      await addCoreLiquidity(parseFloat(amountArg));
      break;

    case "request-withdraw-core":
    case "request-withdraw-sports":
      await requestWithdrawCore();
      break;

    case "withdraw-core":
    case "execute-withdraw-core":
    case "withdraw-sports":
      await executeWithdrawCore();
      break;

    case "add-casino":
    case "add-bankroll":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts add-casino 500");
        process.exit(1);
      }
      await addCasinoLiquidity(parseFloat(amountArg));
      break;

    case "withdraw-casino":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts withdraw-casino 200 [optionalRecipient]");
        process.exit(1);
      }
      await withdrawCasinoLiquidity(parseFloat(amountArg), recipientArg);
      break;

    case "add-crash":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts add-crash 500");
        process.exit(1);
      }
      await addCrashLiquidity(parseFloat(amountArg));
      break;

    case "withdraw-crash":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts withdraw-crash 200 [optionalRecipient]");
        process.exit(1);
      }
      await withdrawCrashLiquidity(parseFloat(amountArg), recipientArg);
      break;

    case "add-virtual":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts add-virtual 10000");
        process.exit(1);
      }
      await addVirtualCredit(parseFloat(amountArg));
      break;

    case "add-all":
      if (!amountArg) {
        console.error("❌ Error: Missing amount. Example: npx tsx scripts/manage-liquidity.ts add-all 500");
        process.exit(1);
      }
      const amt = parseFloat(amountArg);
      console.log(`\n📦 Adding $${amt} USDC across Sports Pool, Casino Vault, AND Crash Game Vault...`);
      await addCoreLiquidity(amt);
      await addCasinoLiquidity(amt);
      await addCrashLiquidity(amt);
      break;

    default:
      console.log(`
SportyStake Protocol Liquidity Manager

Commands:
  check                                        Display on-chain liquidity for Sports, Casino & Crash vaults
  add-core <amountUSDC>                        Deposit USDC into Core Sports Betting Pool (LiquidityPool.sol)
  request-withdraw-core                        Initiate LP withdrawal request from Sports Pool (starts 48h cooldown)
  withdraw-core                                Execute LP withdrawal from Sports Pool (burns shares & returns USDC)
  add-casino <amountUSDC>                      Deposit USDC bankroll into Casino House (CasinoHouse.sol)
  withdraw-casino <amountUSDC> [recipient]     Withdraw USDC from Casino House (capped by active game exposure)
  add-crash <amountUSDC>                       Deposit USDC bankroll into Crash Game (CrashGame.sol)
  withdraw-crash <amountUSDC> [recipient]      Withdraw USDC from Crash Game (capped by round payouts)
  add-virtual <amountUSDC>                     Add virtual capacity credit to Sports Pool
  add-all <amountUSDC>                         Fund Sports Pool, Casino Vault, and Crash Game with <amountUSDC> each

Examples:
  npx tsx scripts/manage-liquidity.ts check
  npx tsx scripts/manage-liquidity.ts add-core 1000
  npx tsx scripts/manage-liquidity.ts add-casino 500
  npx tsx scripts/manage-liquidity.ts add-crash 500
  npx tsx scripts/manage-liquidity.ts withdraw-crash 100
`);
  }
}

main().catch((err) => {
  console.error("\n❌ Liquidity Management Script Failed:", err.message || err);
  process.exit(1);
});
