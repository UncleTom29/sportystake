/**
 * Base class for all SportyStake SDK errors. Use `error.code` to programmatically
 * branch on error kind.
 */
export class SportyStakeSDKError extends Error {
  public readonly code: string;
  public override readonly cause: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'SportyStakeSDKError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractRevertError extends SportyStakeSDKError {
  public readonly reason: string | undefined;
  public readonly data: string | undefined;

  constructor(message: string, opts: { reason?: string; data?: string; cause?: unknown } = {}) {
    super('CONTRACT_REVERT', message, opts.cause);
    this.name = 'ContractRevertError';
    this.reason = opts.reason;
    this.data = opts.data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkMismatchError extends SportyStakeSDKError {
  public readonly expectedChainId: number;
  public readonly actualChainId: number | undefined;

  constructor(expectedChainId: number, actualChainId?: number, cause?: unknown) {
    super(
      'NETWORK_MISMATCH',
      `Wrong network: expected chain ${expectedChainId}${
        actualChainId !== undefined ? `, got ${actualChainId}` : ''
      }`,
      cause,
    );
    this.name = 'NetworkMismatchError';
    this.expectedChainId = expectedChainId;
    this.actualChainId = actualChainId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientBalanceError extends SportyStakeSDKError {
  public readonly required: bigint;
  public readonly available: bigint;
  public readonly token: string;

  constructor(required: bigint, available: bigint, token = 'USDC', cause?: unknown) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient ${token} balance: needed ${required.toString()}, have ${available.toString()}`,
      cause,
    );
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
    this.token = token;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UserRejectedError extends SportyStakeSDKError {
  constructor(cause?: unknown) {
    super('USER_REJECTED', 'User rejected the transaction', cause);
    this.name = 'UserRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidInputError extends SportyStakeSDKError {
  constructor(message: string, cause?: unknown) {
    super('INVALID_INPUT', message, cause);
    this.name = 'InvalidInputError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Best-effort classification of arbitrary errors thrown by viem/wagmi/ethers
 * into the SportyStake SDK error taxonomy. The original error is preserved on
 * `.cause`.
 */
export function mapViemError(error: unknown): SportyStakeSDKError {
  if (error instanceof SportyStakeSDKError) return error;

  const e = error as {
    name?: string;
    code?: number | string;
    message?: string;
    shortMessage?: string;
    cause?: unknown;
    details?: string;
    data?: string;
    reason?: string;
  };

  const name = typeof e?.name === 'string' ? e.name : '';
  const message = e?.shortMessage ?? e?.message ?? '';
  const lowered = message.toLowerCase();

  // User rejection
  if (
    name === 'UserRejectedRequestError' ||
    e?.code === 4001 ||
    e?.code === 'ACTION_REJECTED' ||
    lowered.includes('user rejected') ||
    lowered.includes('user denied')
  ) {
    return new UserRejectedError(error);
  }

  // Chain mismatch
  if (
    name === 'ChainMismatchError' ||
    name === 'ChainDisconnectedError' ||
    name === 'SwitchChainError' ||
    lowered.includes('chain mismatch') ||
    lowered.includes('does not match the target chain') ||
    lowered.includes('wrong network')
  ) {
    return new NetworkMismatchError(0, undefined, error);
  }

  // Insufficient balance / funds
  if (
    lowered.includes('insufficient funds') ||
    lowered.includes('insufficient balance') ||
    lowered.includes('transfer amount exceeds balance')
  ) {
    return new InsufficientBalanceError(0n, 0n, 'USDC', error);
  }

  // Contract revert
  if (
    name === 'ContractFunctionExecutionError' ||
    name === 'ContractFunctionRevertedError' ||
    name === 'CallExecutionError' ||
    name === 'RawContractError' ||
    lowered.includes('reverted') ||
    lowered.includes('execution reverted')
  ) {
    return new ContractRevertError(message || 'Contract execution reverted', {
      reason: e?.reason,
      data: e?.data,
      cause: error,
    });
  }

  return new SportyStakeSDKError('UNKNOWN', message || String(error), error);
}
