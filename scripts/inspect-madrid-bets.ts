import { createPublicClient, http, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;
  const madridMarketId = "0xde9f58d895c51ae0dffa4445e18a20ffbb07083bbb048f9ea820d55322a1267c";

  const currentBlock = await client.getBlockNumber();
  const chunkSize = 5000n;
  const totalBlocks = 35000n;

  const betPlacedEvent = parseAbiItem("event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount, uint256 potentialPayout, uint256 oddsX1000)");

  const placedLogs: any[] = [];
  for (let from = currentBlock - totalBlocks; from < currentBlock; from += chunkSize) {
    const to = from + chunkSize > currentBlock ? currentBlock : from + chunkSize;
    const logs = await client.getLogs({
      address: contractAddr,
      event: betPlacedEvent,
      args: { marketId: madridMarketId },
      fromBlock: from,
      toBlock: to,
    });
    placedLogs.push(...logs);
  }

  console.log(`Found ${placedLogs.length} bets placed on Real Madrid market (${madridMarketId}):`);
  for (const log of placedLogs) {
    const betId = log.args.betId;
    const onChainBet: any = await client.readContract({
      address: contractAddr,
      abi: bettingCoreAbi,
      functionName: "bets",
      args: [betId!],
    });

    console.log({
      betId,
      bettor: log.args.bettor,
      outcome: log.args.outcome,
      amount: log.args.amount?.toString(),
      payout: log.args.potentialPayout?.toString(),
      status: ["Pending", "Won", "Lost", "Cancelled", "Cashed"][onChainBet[5]] || onChainBet[5],
      tx: log.transactionHash,
      block: log.blockNumber?.toString()
    });
  }

  // Also check if there are other Real Madrid markets created on chain
  const marketSettledEvent = parseAbiItem("event MarketSettled(bytes32 indexed marketId, uint8 winningOutcome, uint256 totalBetAmount, uint256 totalPayout, uint256 houseEdge)");
  const settledLogs: any[] = [];
  for (let from = currentBlock - totalBlocks; from < currentBlock; from += chunkSize) {
    const to = from + chunkSize > currentBlock ? currentBlock : from + chunkSize;
    const logs = await client.getLogs({
      address: contractAddr,
      event: marketSettledEvent,
      fromBlock: from,
      toBlock: to,
    });
    settledLogs.push(...logs);
  }

  console.log(`\nAll MarketSettled events in range (${settledLogs.length}):`);
  for (const s of settledLogs) {
    console.log("Settled Market:", s.args.marketId, "winningOutcome:", s.args.winningOutcome, "totalPayout:", s.args.totalPayout?.toString(), "tx:", s.transactionHash);
  }
}

main().catch(console.error);
