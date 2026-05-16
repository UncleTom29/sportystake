import { encodePacked, formatUnits, keccak256, parseUnits } from 'viem';

/** USDC has 6 decimals on every chain it's deployed. */
export const USDC_DECIMALS = 6;

/** Parse a USDC amount (e.g. "12.50") to the bigint base units used by the contracts. */
export function parseUsdc(amount: number | string): bigint {
  return parseUnits(String(amount), USDC_DECIMALS);
}

/** Format USDC base units (bigint) back to a human-readable string. */
export function formatUsdc(raw: bigint, digits = 2): string {
  const s = formatUnits(raw, USDC_DECIMALS);
  const [intPart = '0', decPart = ''] = s.split('.');
  if (digits === 0) return intPart;
  return `${intPart}.${(decPart + '0'.repeat(digits)).slice(0, digits)}`;
}

/**
 * Deterministic marketId derivation: keccak256(abi.encodePacked(fixtureId, market)).
 * Must match the contract-side derivation in MarketPoolFactory.sol.
 */
export function encodeMarketId(fixtureId: number | bigint, market: string): `0x${string}` {
  return keccak256(
    encodePacked(['uint256', 'string'], [BigInt(fixtureId), market]),
  );
}

/** Convert decimal odds (e.g. 1.85) to the integer representation used on-chain. */
export function oddsToX1000(decimalOdds: number): bigint {
  return BigInt(Math.round(decimalOdds * 1000));
}

/** Convert on-chain integer odds back to decimal odds. */
export function oddsFromX1000(oddsX1000: bigint | number): number {
  return Number(oddsX1000) / 1000;
}

/** Compute a minimum-odds floor from a quoted odds & slippage in basis points. */
export function minOddsWithSlippage(oddsX1000: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error(`slippageBps out of range: ${slippageBps}`);
  }
  return (oddsX1000 * BigInt(10000 - slippageBps)) / 10000n;
}

/** Outcome encoding shared with the contracts. */
export const Outcomes = {
  HOME: 0,
  DRAW: 1,
  AWAY: 2,
  OVER: 0,
  UNDER: 1,
  YES: 0,
  NO: 1,
} as const;

export type Outcome = number;

/** Market keys passed to encodeMarketId — kept in sync with the oracle. */
export const Markets = {
  ONE_X_TWO: '1X2',
  OVER_UNDER_15: 'over_under_15',
  OVER_UNDER_25: 'over_under_25',
  OVER_UNDER_35: 'over_under_35',
  BTTS: 'btts',
  DOUBLE_CHANCE: 'double_chance',
  ASIAN_HANDICAP: 'asian_handicap',
} as const;

export type MarketKey = (typeof Markets)[keyof typeof Markets];
