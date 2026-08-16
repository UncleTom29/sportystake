import type {
  Account,
  Address,
  Hash,
  PublicClient,
  WalletClient,
  TransactionReceipt,
} from 'viem';
import { crashGameAbi } from '../contracts/abis/CrashGame.js';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import type { ContractAddresses } from '../contracts/addresses.js';
import {
  InsufficientBalanceError,
  InvalidInputError,
  assertTxSuccess,
  mapViemError,
} from '../errors.js';
import { parseUsdc } from '../utils.js';

export interface CrashClientOpts {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  addresses: ContractAddresses;
}

/** Mirrors `CrashGame.RoundStatus`. */
export enum CrashRoundStatus {
  Pending = 0,
  Running = 1,
  Resolved = 2,
}

export interface CrashRoundView {
  id: bigint;
  serverSeedHash: `0x${string}`;
  serverSeed: `0x${string}`;
  startedAt: bigint;
  resolvedAt: bigint;
  crashMultiplierX100: bigint;
  totalStaked: bigint;
  maxPotentialPayout: bigint;
  status: CrashRoundStatus;
}

export interface JoinRoundReceipt {
  txHash: Hash;
  roundId: bigint;
  amount: bigint;
  blockNumber: bigint;
  receipt: TransactionReceipt;
}

/**
 * Typed wrapper around the CrashGame contract — a multi-player, commit-reveal crash round
 * driven by sportystake's own operator worker (round start/lock/resolve are NOT exposed here;
 * this client only covers the permissionless player actions: join, cash out, claim). Rounds
 * resolve asynchronously on the operator's own timeline, so `joinRound` only locks in a stake
 * (with an optional pre-committed auto-cashout) — the caller must poll `getRound`/
 * `getPayoutCredited` for the outcome once the round resolves.
 */
export class CrashClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient | undefined;
  public readonly addresses: ContractAddresses;

  constructor(opts: CrashClientOpts) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.addresses = opts.addresses;
  }

  // ─── reads ──────────────────────────────────────────────────────────────

  async getCurrentRoundId(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.crashGame,
      abi: crashGameAbi,
      functionName: 'currentRoundId',
    });
  }

  async getRound(roundId: bigint): Promise<CrashRoundView> {
    const r = await this.publicClient.readContract({
      address: this.addresses.crashGame,
      abi: crashGameAbi,
      functionName: 'rounds',
      args: [roundId],
    });
    const [id, serverSeedHash, serverSeed, startedAt, resolvedAt, crashMultiplierX100, totalStaked, maxPotentialPayout, status] = r;
    return { id, serverSeedHash, serverSeed, startedAt, resolvedAt, crashMultiplierX100, totalStaked, maxPotentialPayout, status };
  }

  /** Aggregate withdrawable balance across every round this address has ever played — not
   * attributable to one specific round. Use `getPayoutCredited` when you need the exact amount
   * a single (roundId, player) pair was credited. */
  async getPendingPayout(player: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.crashGame,
      abi: crashGameAbi,
      functionName: 'pendingPayout',
      args: [player],
    });
  }

  /**
   * Reads the exact `PayoutCredited` amount for (roundId, player) from logs. Both fields are
   * indexed on the event, so this is exact even if the player has several resolved-but-unclaimed
   * rounds sitting in the same aggregate `pendingPayout` balance at once. Returns 0n if no
   * event was emitted (the player lost, or auto-cashout never triggered).
   */
  async getPayoutCredited(roundId: bigint, player: Address, fromBlock: bigint, toBlock: bigint | 'latest' = 'latest'): Promise<bigint> {
    const logs = await this.publicClient.getContractEvents({
      address: this.addresses.crashGame,
      abi: crashGameAbi,
      eventName: 'PayoutCredited',
      args: { roundId, player },
      fromBlock,
      toBlock,
    });
    if (logs.length === 0) return 0n;
    const args = logs[0]!.args as { amount?: bigint };
    return args.amount ?? 0n;
  }

  async getRoundPlayerCount(roundId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.crashGame,
      abi: crashGameAbi,
      functionName: 'getRoundPlayerCount',
      args: [roundId],
    });
  }

  // ─── writes ─────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new InvalidInputError('CrashClient: no walletClient configured');
    }
    return this.walletClient;
  }

  private requireAccount(account?: Address): Address {
    const acct = account ?? this.walletClient?.account?.address;
    if (!acct) {
      throw new InvalidInputError('CrashClient: no account available');
    }
    return acct;
  }

  private resolveSigner(account?: Address): Account | Address {
    if (account) return account;
    const walletAccount = this.walletClient?.account;
    if (!walletAccount) {
      throw new InvalidInputError('CrashClient: no account available');
    }
    return walletAccount;
  }

  /**
   * Join the given (pending) round. `autoCashoutX100` scaled by 100 (250 = 2.50x); pass 0 to
   * disable auto-cashout (only safe for a caller that will also call `cashOut` manually before
   * the round resolves — an unattended agent should always set a real auto-cashout).
   */
  async joinRound(roundId: bigint, amountUsdc: number | string, autoCashoutX100: number, account?: Address): Promise<JoinRoundReceipt> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const amount = parseUsdc(amountUsdc);

      const balance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [acct],
      });
      if (balance < amount) {
        throw new InsufficientBalanceError(amount, balance, 'USDC');
      }

      const allowance = await this.publicClient.readContract({
        address: this.addresses.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [acct, this.addresses.crashGame],
      });
      if (allowance < amount) {
        const approveTx = await wallet.writeContract({
          account: this.resolveSigner(account),
          chain: wallet.chain,
          address: this.addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.addresses.crashGame, amount],
        });
        const approveReceipt = await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        assertTxSuccess(approveReceipt, 'approve');
      }

      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.crashGame,
        abi: crashGameAbi,
        functionName: 'joinRound',
        args: [roundId, amount, BigInt(autoCashoutX100)],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'joinRound');
      return { txHash, roundId, amount, blockNumber: receipt.blockNumber, receipt };
    } catch (err) {
      throw mapViemError(err);
    }
  }

  /** Self-service cash out before the round resolves. Only meaningful if the caller is actively
   * watching the round's live multiplier — an unattended agent should rely on `autoCashoutX100`
   * at join time instead. */
  async cashOut(roundId: bigint, multiplierX100: number, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.crashGame,
        abi: crashGameAbi,
        functionName: 'cashOut',
        args: [roundId, BigInt(multiplierX100)],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'cashOut');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  /** Pull-payment withdrawal of the caller's total accumulated `pendingPayout` across every
   * resolved round it hasn't claimed yet. Reverts on-chain if nothing is pending. */
  async claim(account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.crashGame,
        abi: crashGameAbi,
        functionName: 'claim',
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'claim');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
