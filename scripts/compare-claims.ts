import { createPublicClient, http, decodeFunctionData, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;

  // 1. Successful Claim Tx
  const txSuccessHash = "0x67187e74f3afb6599829ba822b8378ba4f076ddce3e353f041029c337b375a5d";
  const txSuccess = await client.getTransaction({ hash: txSuccessHash });
  const receiptSuccess = await client.getTransactionReceipt({ hash: txSuccessHash });
  console.log("=== SUCCESSFUL CLAIM TX ===");
  console.log("From:", txSuccess.from);
  console.log("Input:", txSuccess.input);
  const betIdSuccess = "0x" + txSuccess.input.slice(10);
  console.log("Bet ID:", betIdSuccess);

  // 2. Failed Claim Tx
  const txFailHash = "0xfc415ce6599015bf2d07c17499e6073adc8e86b452c60504a1c9c0d2499266e7";
  const txFail = await client.getTransaction({ hash: txFailHash });
  console.log("\n=== FAILED CLAIM TX ===");
  console.log("From:", txFail.from);
  console.log("Input:", txFail.input);
  const betIdFail = "0x" + txFail.input.slice(10);
  console.log("Bet ID:", betIdFail);

  // 3. Read both bets from BettingCore
  const bet1: any = await client.readContract({ address: contractAddr, abi: bettingCoreAbi, functionName: "bets", args: [betIdSuccess as `0x${string}`] });
  const bet2: any = await client.readContract({ address: contractAddr, abi: bettingCoreAbi, functionName: "bets", args: [betIdFail as `0x${string}`] });

  console.log("\n=== BET DETAILS ===");
  console.log("Bet 1 (Success):", {
    bettor: bet1[0],
    marketId: bet1[1],
    outcome: bet1[2],
    amount: bet1[3].toString(),
    payout: bet1[4].toString(),
    status: bet1[5],
    oddsX1000: bet1[6].toString(),
    createdAt: new Date(Number(bet1[7]) * 1000).toISOString(),
  });

  console.log("Bet 2 (Failed):", {
    bettor: bet2[0],
    marketId: bet2[1],
    outcome: bet2[2],
    amount: bet2[3].toString(),
    payout: bet2[4].toString(),
    status: bet2[5],
    oddsX1000: bet2[6].toString(),
    createdAt: new Date(Number(bet2[7]) * 1000).toISOString(),
  });

  // 4. Read both markets from BettingCore
  const m1: any = await client.readContract({ address: contractAddr, abi: bettingCoreAbi, functionName: "markets", args: [bet1[1]] });
  const m2: any = await client.readContract({ address: contractAddr, abi: bettingCoreAbi, functionName: "markets", args: [bet2[1]] });

  console.log("\n=== MARKET DETAILS ===");
  console.log("Market 1 (from Bet 1):", {
    id: m1[0],
    status: m1[1],
    winningOutcome: m1[2],
    totalBetAmount: m1[3].toString(),
    totalPayoutRequired: m1[4].toString(),
    closesAt: new Date(Number(m1[5]) * 1000).toISOString(),
    fillRatioX1000: m1[6].toString(),
  });

  console.log("Market 2 (from Bet 2):", {
    id: m2[0],
    status: m2[1],
    winningOutcome: m2[2],
    totalBetAmount: m2[3].toString(),
    totalPayoutRequired: m2[4].toString(),
    closesAt: new Date(Number(m2[5]) * 1000).toISOString(),
    fillRatioX1000: m2[6].toString(),
  });
}

main().catch(console.error);
