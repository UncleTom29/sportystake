/**
 * Server-side verification for CasinoHouse.placeCasinoBet — same trust
 * posture as `betVerification.ts`/`liquidityVerification.ts`.
 */
import { decodeEventLog, type TransactionReceipt } from "viem";
import { clientEnv } from "@/lib/env";
import { publicClient } from "@/lib/server/chain";
import { ApiError } from "@/lib/server/api-response";
import { casinoHouseAbi } from "../../../packages/sdk/src/contracts/abis/CasinoHouse";

function casinoHouseAddress() {
  return clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS as `0x${string}`;
}

export interface VerifiedCasinoBet {
  requestId: `0x${string}`;
  player: `0x${string}`;
  game: number;
  amount: bigint;
  clientSeed: `0x${string}`;
}

/** Verifies a `placeCasinoBet` tx actually happened and was sent by `expectedPlayer`. */
export async function verifyCasinoBetPlaced(txHash: `0x${string}`, expectedPlayer: string): Promise<VerifiedCasinoBet> {
  const receipt = await publicClient().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new ApiError("TransactionFailed", "The on-chain transaction did not succeed", 409);
  }
  if (receipt.to?.toLowerCase() !== casinoHouseAddress().toLowerCase()) {
    throw new ApiError("WrongContract", "Transaction was not sent to CasinoHouse", 400);
  }

  for (const log of receipt.logs as TransactionReceipt["logs"]) {
    try {
      const decoded = decodeEventLog({ abi: casinoHouseAbi, data: log.data, topics: log.topics });
      if (decoded.eventName !== "BetReceived") continue;
      const args = decoded.args;
      const player = args.player as string;
      if (player.toLowerCase() !== expectedPlayer.toLowerCase()) {
        throw new ApiError("PlayerMismatch", "Transaction was not sent by the signed-in wallet", 403);
      }
      return {
        requestId: args.requestId as `0x${string}`,
        player: player as `0x${string}`,
        game: Number(args.game),
        amount: args.amount as bigint,
        clientSeed: args.clientSeed as `0x${string}`,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Not a matching log — skip.
    }
  }
  throw new ApiError("EventNotFound", "No BetReceived event in this transaction", 400);
}
