"use client";

// Bridges the existing BetSelection shape (matchId, matchLabel, market, selection, odds)
// to a real on-chain BettingCore.placeBet/placeParlayBet call signed by the
// user's Privy wallet, then persists the confirmed receipt via the API.

import { decodeEventLog, type Address, type TransactionReceipt } from "viem";
import type { BetSelection } from "@/lib/betSlipStore";
import type { BetDTO, ParlayDTO, MarketDTO, MarketType, MarketAttestationDTO } from "@/lib/types";
import { Markets, Bets } from "@/lib/api-client";
import { useWallet } from "@/lib/walletStore";
import { clientEnv } from "@/lib/env";
import { privyApproveIfNeeded, privyContractWrite } from "@/lib/privyTx";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { bettingCoreAbi } from "../../packages/sdk/src/contracts/abis/BettingCore";
import { parseUsdc, minOddsWithSlippage } from "../../packages/sdk/src/utils";

interface ResolvedLeg {
  marketId: `0x${string}`;
  marketType: MarketType;
  outcome: number;
  selectionLabel: string;
  oddsX1000: number;
  /** Present only when the market isn't registered on BettingCore yet — see MarketDTO.attestation. */
  attestation?: MarketAttestationDTO;
}

/** [marketId, closesAt, validUntil, signature] — positional tuple matching IBettingCore.MarketAttestation. */
type AttestationTuple = [`0x${string}`, bigint, bigint, `0x${string}`];

function attestationTuple(marketId: `0x${string}`, attestation?: MarketAttestationDTO): AttestationTuple {
  if (!attestation) return [marketId, 0n, 0n, "0x"];
  return [marketId, BigInt(attestation.closesAt), BigInt(attestation.validUntil), attestation.signature as `0x${string}`];
}

const DEFAULT_SLIPPAGE_BPS = 50;

function marketTypeFromMarketName(name: string): MarketType {
  const n = name.toLowerCase();
  if (n.includes("yes") || n.includes("no") || n.includes("binary") || n.includes("prediction")) return "binary";
  if (n.includes("over") && n.includes("1.5")) return "over_under_15";
  if (n.includes("over") && n.includes("3.5")) return "over_under_35";
  if (n.includes("over") || n.includes("under") || n.includes("o/u")) return "over_under_25";
  if (n.includes("btts") || n.includes("both teams")) return "btts";
  if (n.includes("double")) return "double_chance";
  if (n.includes("handicap")) return "asian_handicap";
  if (n.includes("half")) return "half_time_result";
  return "1X2";
}

async function resolveLeg(sel: BetSelection): Promise<ResolvedLeg | null> {
  let market: MarketDTO | null = null;
  try {
    market = await Markets.detail(sel.matchId);
  } catch {
    return null;
  }
  if (!market) return null;
  const candidateType = marketTypeFromMarketName(sel.market);
  const bundle = market.odds.find((b) => b.marketType === candidateType) ?? market.odds[0];
  if (!bundle) return null;
  const byLabel = bundle.selections.find((s) => s.label.toLowerCase() === sel.selection.toLowerCase());
  const closest = byLabel ?? bundle.selections.reduce((best, cur) => {
    const dBest = Math.abs(best.valueX1000 - Math.round(sel.odds * 1000));
    const dCur = Math.abs(cur.valueX1000 - Math.round(sel.odds * 1000));
    return dCur < dBest ? cur : best;
  }, bundle.selections[0]);

  return {
    marketId: market.id as `0x${string}`,
    marketType: bundle.marketType,
    outcome: closest.outcome,
    selectionLabel: closest.label,
    oddsX1000: closest.valueX1000,
    attestation: market.attestation,
  };
}

function requireAddress(): Address {
  const address = useWallet.getState().address;
  if (!address) throw new Error("Sign in first");
  return address;
}

function decodeBetId(logs: TransactionReceipt["logs"]): `0x${string}` | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: bettingCoreAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "BetPlaced") {
        return (decoded.args as { betId: `0x${string}` }).betId;
      }
    } catch {
      // not our event
    }
  }
  return null;
}

export async function placeSingleBets(
  selections: BetSelection[],
  stakePerBet: number,
  opts?: { isLive?: boolean; isPublic?: boolean; slippageToleranceBps?: number },
): Promise<{ placed: BetDTO[]; failures: { selection: BetSelection; error: string }[] }> {
  if (stakePerBet <= 0) throw new Error("Stake must be greater than zero");
  const address = requireAddress();
  const bettingCore = (CONTRACT_ADDRESSES.bettingCore || clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS) as Address;
  const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as Address;
  const amount = parseUsdc(stakePerBet);

  const placed: BetDTO[] = [];
  const failures: { selection: BetSelection; error: string }[] = [];

  for (const sel of selections) {
    const resolved = await resolveLeg(sel);
    if (!resolved) {
      failures.push({ selection: sel, error: "Market not found" });
      continue;
    }
    try {
      const oddsX1000 = BigInt(resolved.oddsX1000);
      const minOddsX1000 = minOddsWithSlippage(oddsX1000, opts?.slippageToleranceBps ?? DEFAULT_SLIPPAGE_BPS);

      await privyApproveIfNeeded({ token: usdc, owner: address, spender: bettingCore, amount });
      const receipt = resolved.attestation
        ? await privyContractWrite({
            contractAddress: bettingCore,
            abiFunctionSignature:
              "placeBetWithAttestation(uint8,uint256,uint256,uint256,(bytes32,uint64,uint64,bytes))",
            abiParameters: [
              resolved.outcome,
              amount,
              oddsX1000,
              minOddsX1000,
              attestationTuple(resolved.marketId, resolved.attestation),
            ],
          })
        : await privyContractWrite({
            contractAddress: bettingCore,
            abiFunctionSignature: "placeBet(bytes32,uint8,uint256,uint256,uint256)",
            abiParameters: [resolved.marketId, resolved.outcome, amount, oddsX1000, minOddsX1000],
          });
      const betId = decodeBetId(receipt.logs);

      const r = await Bets.place({
        txHash: receipt.transactionHash,
        marketType: resolved.marketType,
        selectionLabel: resolved.selectionLabel,
        isLive: opts?.isLive ?? false,
        isPublic: opts?.isPublic ?? true,
      });
      void betId;
      placed.push(r.bet);
    } catch (e) {
      failures.push({ selection: sel, error: (e as Error).message });
    }
  }
  return { placed, failures };
}

export async function placeParlay(
  selections: BetSelection[],
  totalStake: number,
  opts?: { isPublic?: boolean; slippageToleranceBps?: number },
): Promise<{ parlay: ParlayDTO | null; failures: { selection: BetSelection; error: string }[] }> {
  const legs: ResolvedLeg[] = [];
  const failures: { selection: BetSelection; error: string }[] = [];
  for (const sel of selections) {
    const resolved = await resolveLeg(sel);
    if (!resolved) failures.push({ selection: sel, error: "Market not found" });
    else legs.push(resolved);
  }
  if (legs.length < 2) return { parlay: null, failures };

  try {
    const address = requireAddress();
    const bettingCore = (CONTRACT_ADDRESSES.bettingCore || clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS) as Address;
    const usdc = (CONTRACT_ADDRESSES.usdc || clientEnv.NEXT_PUBLIC_USDC_ADDRESS) as Address;
    const stake = parseUsdc(totalStake);

    const combinedOddsX1000 = legs.reduce((acc, leg) => (acc * BigInt(leg.oddsX1000)) / 1000n, 1000n);
    const minCombinedOddsX1000 = minOddsWithSlippage(
      combinedOddsX1000,
      opts?.slippageToleranceBps ?? DEFAULT_SLIPPAGE_BPS,
    );

    await privyApproveIfNeeded({ token: usdc, owner: address, spender: bettingCore, amount: stake });
    const needsAttestation = legs.some((l) => l.attestation);
    const receipt = needsAttestation
      ? await privyContractWrite({
          contractAddress: bettingCore,
          abiFunctionSignature:
            "placeParlayBetWithAttestations(bytes32[],uint8[],uint256,uint256,uint256,(bytes32,uint64,uint64,bytes)[])",
          abiParameters: [
            legs.map((l) => l.marketId),
            legs.map((l) => l.outcome),
            stake,
            combinedOddsX1000,
            minCombinedOddsX1000,
            legs.map((l) => attestationTuple(l.marketId, l.attestation)),
          ],
          // The flat 500_000n default (see privyTx.ts) only covers cheap
          // calls — each attested leg here does signature recovery +
          // on-chain market registration, which measured at ~197k gas/leg
          // on a 2-leg parlay (494k of 500k used, one leg away from an
          // out-of-gas revert). Scaled per-leg, up to MAX_PARLAY_LEGS (10)
          // in BettingCore.sol. Costs nothing extra unused — only gas
          // actually consumed is billed.
          gas: 300_000n + BigInt(legs.length) * 300_000n,
        })
      : await privyContractWrite({
          contractAddress: bettingCore,
          abiFunctionSignature: "placeParlayBet(bytes32[],uint8[],uint256,uint256,uint256)",
          abiParameters: [
            legs.map((l) => l.marketId),
            legs.map((l) => l.outcome),
            stake,
            combinedOddsX1000,
            minCombinedOddsX1000,
          ],
          gas: 300_000n + BigInt(legs.length) * 150_000n,
        });

    const r = await Bets.parlay({
      txHash: receipt.transactionHash,
      legs: legs.map((l) => ({
        marketId: l.marketId,
        selectionLabel: l.selectionLabel,
        marketType: l.marketType,
        oddsX1000: l.oddsX1000,
      })),
      isPublic: opts?.isPublic ?? true,
    });

    return { parlay: r.parlay ?? null, failures };
  } catch (e) {
    return { parlay: null, failures: [{ selection: selections[0], error: (e as Error).message }] };
  }
}
