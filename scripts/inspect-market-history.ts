import { createPublicClient, http, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;
  const marketId = "0x581b8af1882da8e60e2aff129b8cb5ef31d28f82183e68f8959cb311eb6c3ab4";

  const currentBlock = await client.getBlockNumber();
  const chunkSize = 5000n;
  const totalBlocks = 30000n;
  
  const betPlacedEvent = parseAbiItem("event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount, uint256 potentialPayout, uint256 oddsX1000)");
  const marketSettledEvent = parseAbiItem("event MarketSettled(bytes32 indexed marketId, uint8 winningOutcome, uint256 totalBetAmount, uint256 totalPayout, uint256 houseEdge)");
  const winningsClaimedEvent = parseAbiItem("event WinningsClaimed(bytes32 indexed betId, address indexed bettor, uint256 payout)");
  const refundClaimedEvent = parseAbiItem("event RefundClaimed(bytes32 indexed betId, address indexed bettor, uint256 refundAmount)");

  const allPlaced: any[] = [];
  const allSettled: any[] = [];
  const allClaimed: any[] = [];
  const allRefunds: any[] = [];

  for (let from = currentBlock - totalBlocks; from < currentBlock; from += chunkSize) {
    const to = from + chunkSize > currentBlock ? currentBlock : from + chunkSize;
    console.log(`Querying blocks ${from} to ${to}...`);
    
    const [placed, settled, claimed, refunds] = await Promise.all([
      client.getLogs({ address: contractAddr, event: betPlacedEvent, args: { marketId }, fromBlock: from, toBlock: to }),
      client.getLogs({ address: contractAddr, event: marketSettledEvent, args: { marketId }, fromBlock: from, toBlock: to }),
      client.getLogs({ address: contractAddr, event: winningsClaimedEvent, fromBlock: from, toBlock: to }),
      client.getLogs({ address: contractAddr, event: refundClaimedEvent, fromBlock: from, toBlock: to }),
    ]);

    allPlaced.push(...placed);
    allSettled.push(...settled);
    allClaimed.push(...claimed);
    allRefunds.push(...refunds);
  }

  console.log(`\n=== BETS PLACED (${allPlaced.length}) ===`);
  for (const log of allPlaced) {
    const onChainBet: any = await client.readContract({
      address: contractAddr,
      abi: bettingCoreAbi,
      functionName: "bets",
      args: [log.args.betId!],
    });
    console.log({
      betId: log.args.betId,
      bettor: log.args.bettor,
      outcome: log.args.outcome,
      amount: log.args.amount?.toString(),
      payout: log.args.potentialPayout?.toString(),
      onChainStatus: ["Pending", "Won", "Lost", "Cashed", "Cancelled"][onChainBet[5]] || onChainBet[5],
      tx: log.transactionHash,
      block: log.blockNumber?.toString()
    });
  }

  console.log(`\n=== MARKET SETTLED EVENTS (${allSettled.length}) ===`);
  for (const log of allSettled) {
    console.log(log.args, "tx:", log.transactionHash, "block:", log.blockNumber?.toString());
  }

  console.log(`\n=== WINNINGS CLAIMED EVENTS (${allClaimed.length}) ===`);
  for (const log of allClaimed) {
    console.log(log.args, "tx:", log.transactionHash, "block:", log.blockNumber?.toString());
  }

  console.log(`\n=== REFUND CLAIMED EVENTS (${allRefunds.length}) ===`);
  for (const log of allRefunds) {
    console.log(log.args, "tx:", log.transactionHash, "block:", log.blockNumber?.toString());
  }
}

main().catch(console.error);
