import type {
  Account,
  Address,
  Hash,
  PublicClient,
  WalletClient,
  TransactionReceipt,
} from 'viem';
import { decodeEventLog } from 'viem';
import { casinoHouseAbi } from '../contracts/abis/CasinoHouse.js';
import { erc20Abi } from '../contracts/abis/ERC20.js';
import type { ContractAddresses } from '../contracts/addresses.js';
import {
  InsufficientBalanceError,
  InvalidInputError,
  assertTxSuccess,
  mapViemError,
} from '../errors.js';
import { parseUsdc } from '../utils.js';

export interface CasinoClientOpts {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  addresses: ContractAddresses;
}

/** Mirrors `CasinoHouse.GameType`. */
export enum CasinoGameType {
  Dice = 0,
  Slots = 1,
  Blackjack = 2,
  Roulette = 3,
  Baccarat = 4,
}

export interface PlaceCasinoBetParams {
  /** USDC amount as a human-readable number/string (e.g. 25 or "25.50"). */
  amountUsdc: number | string;
  game: CasinoGameType;
  /** keccak256 hash of the caller's plaintext client seed. */
  clientSeedHash: `0x${string}`;
}

export interface CasinoBetReceipt {
  requestId: `0x${string}`;
  txHash: Hash;
  amount: bigint;
  receipt: TransactionReceipt;
}

export interface CasinoBetView {
  player: Address;
  amount: bigint;
  game: number;
  clientSeed: `0x${string}`;
  settled: boolean;
  payout: bigint;
}

/**
 * Typed wrapper around the CasinoHouse contract — operator-settled, single-bankroll vault for
 * the instant-resolve games (Dice/Slots/Blackjack/Roulette/Baccarat). `settleGame` requires
 * OPERATOR_ROLE on-chain; this client doesn't enforce that itself (the contract does), so any
 * caller can construct one — it just reverts if the connected account lacks the role.
 */
export class CasinoClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient | undefined;
  public readonly addresses: ContractAddresses;

  constructor(opts: CasinoClientOpts) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.addresses = opts.addresses;
  }

  // ─── reads ──────────────────────────────────────────────────────────────

  async getBet(requestId: `0x${string}`): Promise<CasinoBetView> {
    const result = await this.publicClient.readContract({
      address: this.addresses.casinoHouse,
      abi: casinoHouseAbi,
      functionName: 'bets',
      args: [requestId],
    });
    const [player, amount, game, clientSeed, settled, payout] = result;
    return { player, amount, game, clientSeed, settled, payout };
  }

  // ─── writes ─────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new InvalidInputError('CasinoClient: no walletClient configured');
    }
    return this.walletClient;
  }

  private requireAccount(account?: Address): Address {
    const acct = account ?? this.walletClient?.account?.address;
    if (!acct) {
      throw new InvalidInputError('CasinoClient: no account available');
    }
    return acct;
  }

  // Same reasoning as BettingClient's own resolveSigner: a bare Address passed as `account:`
  // to writeContract makes viem sign via the transport's eth_sendTransaction (the browser-wallet
  // flow) instead of locally, which is what every server-side caller of this SDK needs.
  private resolveSigner(account?: Address): Account | Address {
    if (account) return account;
    const walletAccount = this.walletClient?.account;
    if (!walletAccount) {
      throw new InvalidInputError('CasinoClient: no account available');
    }
    return walletAccount;
  }

  /**
   * Place a casino bet. Handles USDC balance check + approval, then submits the
   * placeCasinoBet transaction and returns the resulting requestId from the BetReceived event.
   * Settlement is a separate step — see `settleGame` — since only an OPERATOR_ROLE account can
   * resolve the outcome on-chain.
   */
  async placeCasinoBet(params: PlaceCasinoBetParams, account?: Address): Promise<CasinoBetReceipt> {
    try {
      const wallet = this.requireWallet();
      const acct = this.requireAccount(account);
      const amount = parseUsdc(params.amountUsdc);

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
        args: [acct, this.addresses.casinoHouse],
      });
      if (allowance < amount) {
        const approveTx = await wallet.writeContract({
          account: this.resolveSigner(account),
          chain: wallet.chain,
          address: this.addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.addresses.casinoHouse, amount],
        });
        const approveReceipt = await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        assertTxSuccess(approveReceipt, 'approve');
      }

      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.casinoHouse,
        abi: casinoHouseAbi,
        functionName: 'placeCasinoBet',
        args: [amount, params.game, params.clientSeedHash],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'placeCasinoBet');

      let requestId: `0x${string}` = '0x0';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: casinoHouseAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === 'BetReceived') {
            requestId = decoded.args.requestId;
            break;
          }
        } catch {
          /* not a matching event */
        }
      }

      return { requestId, txHash, amount, receipt };
    } catch (err) {
      throw mapViemError(err);
    }
  }

  /** OPERATOR_ROLE only on-chain — resolves a bet placed via `placeCasinoBet`. */
  async settleGame(requestId: `0x${string}`, randomResult: bigint, payout: bigint, account?: Address): Promise<Hash> {
    try {
      const wallet = this.requireWallet();
      this.requireAccount(account);
      const txHash = await wallet.writeContract({
        account: this.resolveSigner(account),
        chain: wallet.chain,
        address: this.addresses.casinoHouse,
        abi: casinoHouseAbi,
        functionName: 'settleGame',
        args: [requestId, randomResult, payout],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      assertTxSuccess(receipt, 'settleGame');
      return txHash;
    } catch (err) {
      throw mapViemError(err);
    }
  }
}
