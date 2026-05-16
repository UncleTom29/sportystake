import type {
  Address,
  Hash,
  PublicClient,
  WalletClient,
  TransactionReceipt,
} from 'viem';
import { decodeEventLog } from 'viem';
import { bettingCoreAbi } from '../contracts/abis/BettingCore.js';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import type { ContractAddresses } from '../contracts/addresses.js';
import {
  InsufficientBalanceError,
  InvalidInputError,
  mapViemError,
} from '../errors.js';
import {
  encodeMarketId,
  minOddsWithSlippage,
  parseUsdc,
  type MarketKey,
  type Outcome,
} from '../utils.js';

export interface BettingClientOpts {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  addresses: ContractAddresses;
}

export interface PlaceBetParams {
  fixtureId: number | bigint;
  market: MarketKey | string;
  outcome: Outcome;
  /** USDC amount as a human-readable number/string (e.g. 25 or "25.50"). */
  amountUsdc: number | string;
  /** Quoted decimal odds * 1000 (matches what BettingCore expects). */
  oddsX1000: number | bigint;
  /** Slippage in basis points (default 50 = 0.50%). */
  slippageBps?: number;
}

export interface BetReceipt {
  betId: `0x${string}`;
  txHash: Hash;
  marketId: `0x${string}`;
  outcome: Outcome;
  amount: bigint;
  oddsX1000: bigint;
  receipt: TransactionReceipt;
}

export interface MarketView {
  marketId: `0x${string}`;
  pool: Address;
  closeTime: bigint;
  status: number;
  winningOutcome: number;
  totalBetAmount: bigint;
  totalPayoutRequired: bigint;
}

export interface BetView {
  bettor: Address;
  marketId: `0x${string}`;
  outcome: number;
  amount: bigint;
  oddsX1000: bigint;
  payout: bigint;
  status: number;
  placedAt: bigint;
}

/**
 * Typed wrapper around the BettingCore contract.
 * - Reads use the provided PublicClient.
 * - Writes require a WalletClient with an attached account.
 * - All errors are mapped to the SDK error taxonomy via `mapViemError`.
 */
export class BettingClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient | undefined;
  public readonly addresses: ContractAddresses;

  constructor(opts: BettingClientOpts) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.addresses = opts.addresses;
  }

  // ─── reads ──────────────────────────────────────────────────────────────

  async getMarket(fixtureId: number | bigint, market: MarketKey | string): Promise<MarketView> {
    const marketId = encodeMarketId(fixtureId, market);
    const result = await this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'markets',
      args: [marketId],
    });
    const [pool, closeTime, status, winningOutcome, totalBetAmount, totalPayoutRequired] = result;
    return { marketId, pool, closeTime, status, winningOutcome, totalBetAmount, totalPayoutRequired };
  }

  async getBet(betId: `0x${string}`): Promise<BetView> {
    const result = await this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'bets',
      args: [betId],
    });
    const [bettor, marketId, outcome, amount, oddsX1000, payout, status, placedAt] = result;
    return { bettor, marketId, outcome, amount, oddsX1000, payout, status, placedAt };
  }

  async getHouseEdgeBps(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'houseEdgeBps',
    });
  }

  // ─── writes ─────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new InvalidInputError('BettingClient: no walletClient configured');
    }
    return this.walletClient;
  }

  private requireAccount(account?: Address): Address {
    const acct = account ?? this.walletClient?.account?.address;
    if (!acct) {
      throw new InvalidInputError('BettingClient: no account available');
    }
    return acct;
  }

  /**
   * Place a bet. Handles USDC balance check + approval, then submits the
   * placeBet transaction and returns the resulting betId from the
   * BetPlaced event.
   */
  async placeBet(params: PlaceBetParams, account?: Address): Promise<BetReceipt> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);

      const marketId = encodeMarketId(params.fixtureId, params.market);
      const amount = parseUsdc(params.amountUsdc);
      const oddsX1000 = typeof params.oddsX1000 === 'bigint'
        ? params.oddsX1000
        : BigInt(Math.round(params.oddsX1000));
      const slippage = params.slippageBps ?? 50;
      const minOdds = minOddsWithSlippage(oddsX1000, slippage);

      // 1. Balance check.
      const balance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [acct],
      });
      if (balance < amount) {
        throw new InsufficientBalanceError(amount, balance, 'USDC');
      }

      // 2. Approval (only if needed).
      const allowance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [acct, this.addresses.bettingCore],
      });
      if (allowance < amount) {
        const approveTx = await wallet.writeContract({
          account: acct,
          chain: wallet.chain,
          address: this.addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.addresses.bettingCore, amount],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 3. Place bet.
      const txHash = await wallet.writeContract({
        account: acct,
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'placeBet',
        args: [marketId, params.outcome, amount, oddsX1000, minOdds],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      // 4. Extract betId from BetPlaced event.
      let betId: `0x${string}` = '0x0';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: bettingCoreAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'BetPlaced') {
            betId = decoded.args.betId;
            break;
          }
        } catch { /* not a matching event */ }
      }

      return { betId, txHash, marketId, outcome: params.outcome, amount, oddsX1000, receipt };
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async claimWinnings(betId: `0x${string}`, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: acct,
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimWinnings',
        args: [betId],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async claimRefund(betId: `0x${string}`, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: acct,
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimRefund',
        args: [betId],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
