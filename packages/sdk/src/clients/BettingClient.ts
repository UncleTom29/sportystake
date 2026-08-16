import type {
  Account,
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
  assertTxSuccess,
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
  closesAt: bigint;
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
  potentialPayout: bigint;
  status: number;
  oddsX1000: bigint;
  placedAt: bigint;
}

export interface PlaceParlayParams {
  legs: { fixtureId: number | bigint; market: MarketKey | string; outcome: Outcome }[];
  /** USDC amount as a human-readable number/string (e.g. 25 or "25.50"). */
  stakeUsdc: number | string;
  /** Combined decimal odds * 1000 (product of each leg's quoted odds). */
  combinedOddsX1000: number | bigint;
  /** Slippage in basis points (default 50 = 0.50%). */
  slippageBps?: number;
}

export interface ParlayReceipt {
  parlayId: `0x${string}`;
  txHash: Hash;
  marketIds: `0x${string}`[];
  outcomes: Outcome[];
  stake: bigint;
  combinedOddsX1000: bigint;
  receipt: TransactionReceipt;
}

export interface ParlayView {
  bettor: Address;
  marketIds: `0x${string}`[];
  outcomes: number[];
  stake: bigint;
  potentialPayout: bigint;
  status: number;
  combinedOddsX1000: bigint;
  placedAt: bigint;
}

/** Mirrors `BettingCore.LegVerdict`. */
export enum ParlayVerdict {
  Pending = 0,
  Won = 1,
  Lost = 2,
  Void = 3,
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
    const [, status, winningOutcome, totalBetAmount, totalPayoutRequired, closesAt] = result;
    return { marketId, closesAt, status, winningOutcome, totalBetAmount, totalPayoutRequired };
  }

  async getBet(betId: `0x${string}`): Promise<BetView> {
    const result = await this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'bets',
      args: [betId],
    });
    const [bettor, marketId, outcome, amount, potentialPayout, status, oddsX1000, placedAt] = result;
    return { bettor, marketId, outcome, amount, potentialPayout, status, oddsX1000, placedAt };
  }

  async getHouseEdgeBps(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'houseEdgeBps',
    });
  }

  async getParlay(parlayId: `0x${string}`): Promise<ParlayView> {
    const p = await this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'getParlay',
      args: [parlayId],
    });
    return {
      bettor: p.bettor,
      marketIds: [...p.marketIds],
      outcomes: [...p.outcomes],
      stake: p.stake,
      potentialPayout: p.potentialPayout,
      status: p.status,
      combinedOddsX1000: p.combinedOddsX1000,
      placedAt: p.placedAt,
    };
  }

  async getParlayVerdict(parlayId: `0x${string}`): Promise<ParlayVerdict> {
    return this.publicClient.readContract({
      address: this.addresses.bettingCore,
      abi: bettingCoreAbi,
      functionName: 'getParlayVerdict',
      args: [parlayId],
    }) as Promise<ParlayVerdict>;
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

  // What to actually pass as `account:` in a writeContract call — distinct from requireAccount
  // (which resolves the plain address used everywhere else, e.g. balanceOf/allowance read args).
  // Passing a bare Address into viem's writeContract makes it treat the account as a "JSON-RPC
  // Account" (sign via the transport's own eth_sendTransaction, the flow a browser wallet
  // needs) instead of signing locally with the attached private key, which is what every
  // server-side caller of this SDK actually needs. An explicit override is passed through as-is:
  // a caller asking for a specific address deliberately wants that JSON-RPC-relay behavior, not
  // local signing under a different key.
  private resolveSigner(account?: Address): Account | Address {
    if (account) return account;
    const walletAccount = this.walletClient?.account;
    if (!walletAccount) {
      throw new InvalidInputError('BettingClient: no account available');
    }
    return walletAccount;
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
          account: this.resolveSigner(account),
          chain: wallet.chain,
          address: this.addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.addresses.bettingCore, amount],
        });
        const approveReceipt = await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        assertTxSuccess(approveReceipt, 'approve');
      }

      // 3. Place bet.
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'placeBet',
        args: [marketId, params.outcome, amount, oddsX1000, minOdds],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'placeBet');

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
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimWinnings',
        args: [betId],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'claimWinnings');
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
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimRefund',
        args: [betId],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'claimRefund');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  /**
   * Place a multi-leg parlay across distinct markets. Wins only if every
   * leg wins — see `BettingCore.placeParlayBet`. Handles USDC balance
   * check + approval, then submits the tx and returns the resulting
   * parlayId from the ParlayPlaced event.
   */
  async placeParlayBet(params: PlaceParlayParams, account?: Address): Promise<ParlayReceipt> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);

      if (params.legs.length < 2) {
        throw new InvalidInputError('placeParlayBet: at least 2 legs required');
      }
      const marketIds = params.legs.map((leg) => encodeMarketId(leg.fixtureId, leg.market));
      const outcomes = params.legs.map((leg) => leg.outcome);
      const stake = parseUsdc(params.stakeUsdc);
      const combinedOddsX1000 = typeof params.combinedOddsX1000 === 'bigint'
        ? params.combinedOddsX1000
        : BigInt(Math.round(params.combinedOddsX1000));
      const slippage = params.slippageBps ?? 50;
      const minCombinedOdds = minOddsWithSlippage(combinedOddsX1000, slippage);

      const balance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [acct],
      });
      if (balance < stake) {
        throw new InsufficientBalanceError(stake, balance, 'USDC');
      }

      const allowance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [acct, this.addresses.bettingCore],
      });
      if (allowance < stake) {
        const approveTx = await wallet.writeContract({
          account: this.resolveSigner(account),
          chain: wallet.chain,
          address: this.addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.addresses.bettingCore, stake],
        });
        const approveReceipt = await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        assertTxSuccess(approveReceipt, 'approve');
      }

      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'placeParlayBet',
        args: [marketIds, outcomes, stake, combinedOddsX1000, minCombinedOdds],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'placeParlayBet');

      let parlayId: `0x${string}` = '0x0';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: bettingCoreAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === 'ParlayPlaced') {
            parlayId = decoded.args.parlayId;
            break;
          }
        } catch { /* not a matching event */ }
      }

      return { parlayId, txHash, marketIds, outcomes, stake, combinedOddsX1000, receipt };
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async claimParlayWinnings(parlayId: `0x${string}`, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimParlayWinnings',
        args: [parlayId],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'claimParlayWinnings');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async claimParlayRefund(parlayId: `0x${string}`, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'claimParlayRefund',
        args: [parlayId],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'claimParlayRefund');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  /** Permissionless — releases a lost parlay's pool lock. See `BettingCore.reportParlayLoss`. */
  async reportParlayLoss(parlayId: `0x${string}`, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.bettingCore,
        abi: bettingCoreAbi,
        functionName: 'reportParlayLoss',
        args: [parlayId],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'reportParlayLoss');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
