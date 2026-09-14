import { createPublicClient, http, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;
  const userB = "0xD45650e113af4a3dC720Fbc6195A9A843F336788";

  const currentBlock = await client.getBlockNumber();
  const chunkSize = 5000n;
  const totalBlocks = 200000n; // look back 200k blocks (~4-5 days)

  const betPlacedEvent = parseAbiItem("event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount, uint256 potentialPayout, uint256 oddsX1000)");

  console.log(`Scanning last ${totalBlocks} blocks for all bets placed by ${userB}...`);

  const placedLogs: any[] = [];
  for (let from = currentBlock - totalBlocks; from < currentBlock; from += chunkSize) {
    const to = from + chunkSize > currentBlock ? currentBlock : from + chunkSize;
    const logs = await client.getLogs({
      address: contractAddr,
      event: betPlacedEvent,
      args: { bettor: userB },
      fromBlock: from,
      toBlock: to,
    });
    placedLogs.push(...logs);
  }

  console.log(`\nFound total ${placedLogs.length} bets placed by User B (${userB}):`);
  for (const log of placedLogs) {
    const betId = log.args.betId;
    const marketId = log.args.marketId;
    const onChainBet: any = await client.readContract({
      address: contractAddr,
      abi: bettingCoreAbi,
      functionName: "bets",
      args: [betId!],
    });
    const onChainMarket: any = await client.readContract({
      address: contractAddr,
      abi: bettingCoreAbi,
      functionName: "markets",
      args: [marketId!],
    });

    console.log({
      betId,
      marketId,
      outcome: log.args.outcome,
      amount: (Number(log.args.amount) / 1e6) + " USDC",
      payout: (Number(log.args.potentialPayout) / 1e6) + " USDC",
      odds: Number(log.args.oddsX1000) / 1000,
      betStatus: ["Pending", "Won", "Lost", "Cancelled", "Cashed"][onChainBet[5]],
      marketStatus: ["Open", "Suspended", "Settled", "Cancelled"][onChainMarket[1]],
      winningOutcome: onChainMarket[2],
      closesAt: new Date(Number(onChainMarket[5]) * 1000).toISOString(),
      tx: log.transactionHash,
      block: log.blockNumber?.toString()
    });
  }
}

main().catch(console.error);
