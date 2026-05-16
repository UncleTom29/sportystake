import type { Address, Hash, PublicClient, WalletClient } from 'viem';
import { marketLiquidityPoolAbi } from '../contracts/abis/MarketLiquidityPool.js';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import type { ContractAddresses } from '../contracts/addresses.js';
import {
  InsufficientBalanceError,
  InvalidInputError,
  mapViemError,
} from '../errors.js';
import { parseUsdc } from '../utils.js';

export interface MarketLiquidityClientOpts {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  poolAddress: Address;
  addresses: ContractAddresses;
}

export interface PoolStats {
  totalLiquidity: bigint;
  totalShares: bigint;
  lockedForPayouts: bigint;
  shareValue: bigint;
  available: bigint;
  utilizationBps: number;
  settled: boolean;
}

export interface UserPosition {
  shares: bigint;
  usdcValue: bigint;
  earnedProfit: bigint;
  withdrawalUnlocksAt: bigint;
}

/**
 * Typed wrapper around a single MarketLiquidityPool contract.
 * Each market has its own pool, so the pool address is fixed per instance.
 */
export class MarketLiquidityClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient | undefined;
  public readonly poolAddress: Address;
  public readonly addresses: ContractAddresses;

  constructor(opts: MarketLiquidityClientOpts) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.poolAddress = opts.poolAddress;
    this.addresses = opts.addresses;
  }

  // ─── reads ──────────────────────────────────────────────────────────────

  async getStats(): Promise<PoolStats> {
    const [totalLiquidity, totalShares, locked, shareValue, settled] = await Promise.all([
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'totalLiquidity',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'totalShares',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'lockedForPayouts',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'getShareValue',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'settled',
      }),
    ]);
    const available = totalLiquidity > locked ? totalLiquidity - locked : 0n;
    const utilizationBps = totalLiquidity === 0n
      ? 0
      : Number((locked * 10000n) / totalLiquidity);
    return { totalLiquidity, totalShares, lockedForPayouts: locked, shareValue, available, utilizationBps, settled };
  }

  async getUserPosition(user: Address): Promise<UserPosition> {
    const [shares, position, withdrawalUnlocksAt] = await Promise.all([
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'shares', args: [user],
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'getUserPosition', args: [user],
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'withdrawalRequests', args: [user],
      }),
    ]);
    const [usdcValue, earnedProfit] = position;
    return { shares, usdcValue, earnedProfit, withdrawalUnlocksAt };
  }

  // ─── writes ─────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new InvalidInputError('MarketLiquidityClient: no walletClient configured');
    }
    return this.walletClient;
  }

  private requireAccount(account?: Address): Address {
    const acct = account ?? this.walletClient?.account?.address;
    if (!acct) {
      throw new InvalidInputError('MarketLiquidityClient: no account available');
    }
    return acct;
  }

  /**
   * Deposit USDC into the pool. Approves the pool to spend USDC if needed.
   * Returns the deposit tx hash and the freshly minted share count.
   */
  async deposit(amountUsdc: number | string, account?: Address): Promise<{ txHash: Hash; sharesMinted: bigint }> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const amount = parseUsdc(amountUsdc);

      const balance = await this.publicClient.readContract({
        address: this.addresses.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [acct],
      });
      if (balance < amount) {
        throw new InsufficientBalanceError(amount, balance, 'USDC');
      }

      const allowance = await this.publicClient.readContract({
        address: this.addresses.usdc, abi: erc20Abi, functionName: 'allowance', args: [acct, this.poolAddress],
      });
      if (allowance < amount) {
        const approveTx = await wallet.writeContract({
          account: acct, chain: wallet.chain,
          address: this.addresses.usdc, abi: erc20Abi,
          functionName: 'approve', args: [this.poolAddress, amount],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      const txHash = await wallet.writeContract({
        account: acct, chain: wallet.chain,
        address: this.poolAddress, abi: marketLiquidityPoolAbi,
        functionName: 'deposit', args: [amount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      // Read fresh share balance after deposit — simpler than decoding events here.
      const sharesMinted = await this.publicClient.readContract({
        address: this.poolAddress, abi: marketLiquidityPoolAbi, functionName: 'shares', args: [acct],
      });
      return { txHash, sharesMinted };
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async requestWithdrawal(account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: acct, chain: wallet.chain,
        address: this.poolAddress, abi: marketLiquidityPoolAbi,
        functionName: 'requestWithdrawal', args: [],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }

  async executeWithdrawal(account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: acct, chain: wallet.chain,
        address: this.poolAddress, abi: marketLiquidityPoolAbi,
        functionName: 'executeWithdrawal', args: [],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
