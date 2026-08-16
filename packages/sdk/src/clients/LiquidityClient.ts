import type { Account, Address, Hash, PublicClient, WalletClient } from 'viem';
import { liquidityPoolAbi } from '../contracts/abis/LiquidityPool.js';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import type { ContractAddresses } from '../contracts/addresses.js';
import {
  InsufficientBalanceError,
  InvalidInputError,
  assertTxSuccess,
  mapViemError,
} from '../errors.js';
import { parseUsdc } from '../utils.js';

export interface LiquidityClientOpts {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  addresses: ContractAddresses;
}

export interface PoolStats {
  totalLiquidity: bigint;
  totalShares: bigint;
  lockedForPayouts: bigint;
  virtualLiquidity: bigint;
  effectiveCapacity: bigint;
  shareValue: bigint;
  available: bigint;
  utilizationBps: number;
}

export interface UserPosition {
  shares: bigint;
  usdcValue: bigint;
  earnedProfit: bigint;
  withdrawalUnlocksAt: bigint;
}

/**
 * Typed wrapper around the single, protocol-wide LiquidityPool contract.
 * Any user (or the protocol itself, via virtual liquidity) can
 * permissionlessly deposit — there is one pool address for the whole
 * protocol, not one per market.
 */
export class LiquidityClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient | undefined;
  public readonly addresses: ContractAddresses;

  constructor(opts: LiquidityClientOpts) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.addresses = opts.addresses;
  }

  private get poolAddress(): Address {
    return this.addresses.liquidityPool;
  }

  // ─── reads ──────────────────────────────────────────────────────────────

  async getStats(): Promise<PoolStats> {
    const [totalLiquidity, totalShares, locked, virtualLiquidity, shareValue] = await Promise.all([
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'totalLiquidity',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'totalShares',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'lockedForPayouts',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'virtualLiquidity',
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'getShareValue',
      }),
    ]);
    const effectiveCapacity = totalLiquidity + virtualLiquidity;
    const available = effectiveCapacity > locked ? effectiveCapacity - locked : 0n;
    const utilizationBps = effectiveCapacity === 0n
      ? 0
      : Number((locked * 10000n) / effectiveCapacity);
    return {
      totalLiquidity,
      totalShares,
      lockedForPayouts: locked,
      virtualLiquidity,
      effectiveCapacity,
      shareValue,
      available,
      utilizationBps,
    };
  }

  /** Currently-locked liquidity attributable to a single market. */
  async getMarketLocked(marketId: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'marketLocked', args: [marketId],
    });
  }

  async getUserPosition(user: Address): Promise<UserPosition> {
    const withdrawalTimelock = await this.publicClient.readContract({
      address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'WITHDRAWAL_TIMELOCK',
    });
    const [shares, position, requestedAt] = await Promise.all([
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'shares', args: [user],
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'getUserPosition', args: [user],
      }),
      this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'withdrawalRequestTime', args: [user],
      }),
    ]);
    const [usdcValue, earnedProfit] = position;
    const withdrawalUnlocksAt = requestedAt === 0n ? 0n : requestedAt + withdrawalTimelock;
    return { shares, usdcValue, earnedProfit, withdrawalUnlocksAt };
  }

  // ─── writes ─────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new InvalidInputError('LiquidityClient: no walletClient configured');
    }
    return this.walletClient;
  }

  private requireAccount(account?: Address): Address {
    const acct = account ?? this.walletClient?.account?.address;
    if (!acct) {
      throw new InvalidInputError('LiquidityClient: no account available');
    }
    return acct;
  }

  // See BettingClient's identical helper for why this returns the full Account rather than
  // just its address on the fallback path — used only for the `account:` field of a
  // writeContract call, never for read-call args (those still want requireAccount's plain
  // address, e.g. balanceOf/allowance/shares above).
  private resolveSigner(account?: Address): Account | Address {
    if (account) return account;
    const walletAccount = this.walletClient?.account;
    if (!walletAccount) {
      throw new InvalidInputError('LiquidityClient: no account available');
    }
    return walletAccount;
  }

  /**
   * Deposit USDC into the shared pool. Permissionless — any address may
   * call this. Approves the pool to spend USDC if needed. Returns the
   * deposit tx hash and the freshly minted share count.
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
          account: this.resolveSigner(account), chain: wallet.chain,
          address: this.addresses.usdc, abi: erc20Abi,
          functionName: 'approve', args: [this.poolAddress, amount],
        });
        const approveReceipt = await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        assertTxSuccess(approveReceipt, 'approve');
      }

      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account), chain: wallet.chain,
        address: this.poolAddress, abi: liquidityPoolAbi,
        functionName: 'deposit', args: [amount],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'deposit');

      // Read fresh share balance after deposit — simpler than decoding events here.
      const sharesMinted = await this.publicClient.readContract({
        address: this.poolAddress, abi: liquidityPoolAbi, functionName: 'shares', args: [acct],
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
        account: this.resolveSigner(account), chain: wallet.chain,
        address: this.poolAddress, abi: liquidityPoolAbi,
        functionName: 'requestWithdrawal', args: [],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'requestWithdrawal');
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
        account: this.resolveSigner(account), chain: wallet.chain,
        address: this.poolAddress, abi: liquidityPoolAbi,
        functionName: 'executeWithdrawal', args: [],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'executeWithdrawal');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
