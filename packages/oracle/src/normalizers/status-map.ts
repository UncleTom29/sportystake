export type MarketStatus = 'OPEN' | 'LIVE' | 'FINISHED' | 'CANCELLED';

/**
 * Maps an Odds-API.io event status to our internal market status.
 *
 *   pending    → OPEN
 *   live       → LIVE
 *   settled    → FINISHED
 *   cancelled  → CANCELLED
 */
export function mapStatus(code: string): MarketStatus {
  switch (code) {
    case 'pending': return 'OPEN';
    case 'live':    return 'LIVE';
    case 'settled': return 'FINISHED';
    case 'cancelled': return 'CANCELLED';
    default: return 'OPEN';
  }
}

export function isLive(code: string): boolean {
  return mapStatus(code) === 'LIVE';
}

export function isFinished(code: string): boolean {
  return mapStatus(code) === 'FINISHED';
}
