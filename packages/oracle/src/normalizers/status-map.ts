import type { ApiFootballFixtureStatus } from '../types/api-football.types.js';

export type MarketStatus = 'OPEN' | 'LIVE' | 'FINISHED' | 'CANCELLED';

/**
 * Maps an API-Football fixture status (short code) to our market status.
 *
 *   NS, TBD                     → OPEN
 *   1H, HT, 2H, ET, BT, P,
 *   SUSP, LIVE, INT             → LIVE
 *   FT, AET, PEN                → FINISHED
 *   PST, CANC, ABD, AWD, WO     → CANCELLED
 */
export function mapStatus(code: ApiFootballFixtureStatus | string): MarketStatus {
  switch (code) {
    case 'NS':
    case 'TBD':
      return 'OPEN';
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'SUSP':
    case 'INT':
    case 'LIVE':
      return 'LIVE';
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'FINISHED';
    case 'PST':
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO':
      return 'CANCELLED';
    default:
      return 'OPEN';
  }
}

export function isLive(code: ApiFootballFixtureStatus | string): boolean {
  return mapStatus(code) === 'LIVE';
}

export function isFinished(code: ApiFootballFixtureStatus | string): boolean {
  return mapStatus(code) === 'FINISHED';
}
