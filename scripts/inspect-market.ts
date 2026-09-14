import { createPublicClient, http } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;
  
  const betId = "0x577ea07df3f0052bf928e9aeed21d21b4a59b0c3adfdcb4adcd28b0cdae8aeed";
  const marketId = "0x581b8af1882da8e60e2aff129b8cb5ef31d28f82183e68f8959cb311eb6c3ab4";

  const onChainBet: any = await client.readContract({
    address: contractAddr,
    abi: bettingCoreAbi,
    functionName: "bets",
    args: [betId],
  });
  console.log("On-chain Bet:", {
    bettor: onChainBet[0],
    marketId: onChainBet[1],
    outcome: onChainBet[2],
    amount: onChainBet[3].toString(),
    potentialPayout: onChainBet[4].toString(),
    status: ["Pending", "Won", "Lost", "Cashed", "Cancelled"][onChainBet[5]] || onChainBet[5],
    oddsX1000: onChainBet[6].toString(),
    createdAt: onChainBet[7].toString(),
  });

  const onChainMarket: any = await client.readContract({
    address: contractAddr,
    abi: bettingCoreAbi,
    functionName: "markets",
    args: [marketId],
  });
  console.log("On-chain Market:", {
    totalBetAmount: onChainMarket[0].toString(),
    totalPayoutRequired: onChainMarket[1].toString(),
    fillRatioX1000: onChainMarket[2].toString(),
    status: ["Open", "Settled", "Cancelled"][onChainMarket[3]] || onChainMarket[3],
    winningOutcome: onChainMarket[4],
    closesAt: onChainMarket[5].toString(),
  });
}

main().catch(console.error);
