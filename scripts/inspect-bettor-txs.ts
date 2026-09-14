import { createPublicClient, http, decodeFunctionData, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";
import { bettingCoreAbi } from "../packages/sdk/src/contracts/abis/BettingCore";

async function main() {
  const client = createPublicClient({ transport: http(clientEnv.NEXT_PUBLIC_RPC_URL) });
  const contractAddr = clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS as `0x${string}`;

  // Let's find the BetPlaced events by searching blocks around the bet creation timestamp
  // createdAt for b1 = 1787746249, b2 = 1787425094
  // Let's check block around 59000000
  const currentBlock = await client.getBlockNumber();
  console.log("Current block:", currentBlock);

  // Let's look up tx for failed claim:
  const failedClaimTx = "0xfc415ce6599015bf2d07c17499e6073adc8e86b452c60504a1c9c0d2499266e7";
  const tx = await client.getTransaction({ hash: failedClaimTx });
  console.log("Failed claim tx sender:", tx.from);
  console.log("Failed claim tx nonce:", tx.nonce);

  // Let's find the sender's previous transactions to find their bet placement tx!
  const bettor = tx.from;
  console.log("Bettor address:", bettor);

  // Search BetPlaced logs where bettor == bettor
  const betPlacedEvent = parseAbiItem("event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount, uint256 potentialPayout, uint256 oddsX1000)");

  let foundPlaced: any[] = [];
  for (let from = currentBlock - 30000n; from < currentBlock; from += 5000n) {
    const to = from + 5000n > currentBlock ? currentBlock : from + 5000n;
    const logs = await client.getLogs({
      address: contractAddr,
      event: betPlacedEvent,
      args: { bettor },
      fromBlock: from,
      toBlock: to,
    });
    foundPlaced.push(...logs);
  }

  console.log(`Found ${foundPlaced.length} bets placed by this user:`);
  for (const log of foundPlaced) {
    console.log("BetPlaced by user:", log.args, "tx:", log.transactionHash, "block:", log.blockNumber);
    const placeTx = await client.getTransaction({ hash: log.transactionHash });
    console.log("Placement function call data:", placeTx.input.slice(0, 10));
    try {
      const decoded = decodeFunctionData({ abi: bettingCoreAbi, data: placeTx.input });
      console.log("Decoded placeBet args:", decoded);
    } catch (e) {
      console.log("Could not decode:", e);
    }
  }
}

main().catch(console.error);
