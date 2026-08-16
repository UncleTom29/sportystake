import type { OddsApiOddsEntry, OddsApiOddsMarket, OddsApiOddsResponse } from '../types/odds-api.types.js';

export type MarketKey =
  | '1X2'
  | 'binary'
  | 'over_under_15'
  | 'over_under_25'
  | 'over_under_35'
  | 'btts'
  | 'double_chance'
  | 'asian_handicap'
  | 'draw_no_bet'
  | 'half_time_result'
  | 'next_team_to_score'
  | string; // allow dynamic market types from GetLine

export interface NormalizedOutcome {
  key: string;
  label: string;
  decimal: number;
  valueX1000: number;
}

export interface NormalizedMarket {
  market: MarketKey;
  outcomes: NormalizedOutcome[];
}

export interface NormalizedOdds {
  fixtureId: number;
  bookmakerName: string;
  updatedAt: string;
  markets: NormalizedMarket[];
}

function parseDecimal(odd: string | undefined): number {
  if (!odd) return 1.01;
  const n = Number.parseFloat(odd);
  if (!Number.isFinite(n) || n <= 1) return 1.01;
  return n;
}

function toOutcome(key: string, label: string, odd: string | undefined): NormalizedOutcome {
  const decimal = parseDecimal(odd);
  return { key, label, decimal, valueX1000: Math.round(decimal * 1000) };
}

function normalizeML(market: OddsApiOddsMarket): NormalizedMarket | null {
  const entry = market.odds[0] as OddsApiOddsEntry | undefined;
  if (!entry) return null;
  const outcomes: NormalizedOutcome[] = [];
  if (entry.home) outcomes.push(toOutcome('1', 'Home', entry.home));
  if (entry.draw) outcomes.push(toOutcome('X', 'Draw', entry.draw));
  if (entry.away) outcomes.push(toOutcome('2', 'Away', entry.away));
  return outcomes.length > 0 ? { market: '1X2', outcomes } : null;
}

function normalizeTotals(market: OddsApiOddsMarket): NormalizedMarket[] {
  const results: NormalizedMarket[] = [];
  for (const entry of market.odds) {
    const line = entry.hdp !== undefined ? String(entry.hdp) : '2.5';
    const n = Number.parseFloat(line);
    let key: MarketKey | null = null;
    if (n === 1.5 || n === 1) key = 'over_under_15';
    else if (n === 2.5 || n === 2) key = 'over_under_25';
    else if (n === 3.5 || n === 3) key = 'over_under_35';
    if (!key) continue;
    const outcomes: NormalizedOutcome[] = [];
    if (entry.over)  outcomes.push(toOutcome('Over',  `Over ${line}`,  entry.over));
    if (entry.under) outcomes.push(toOutcome('Under', `Under ${line}`, entry.under));
    if (outcomes.length > 0) results.push({ market: key, outcomes });
  }
  return results;
}

function normalizeBtts(market: OddsApiOddsMarket): NormalizedMarket | null {
  const entry = market.odds[0] as OddsApiOddsEntry | undefined;
  if (!entry) return null;
  const outcomes: NormalizedOutcome[] = [];
  if (entry.yes) outcomes.push(toOutcome('yes', 'Yes', entry.yes));
  if (entry.no)  outcomes.push(toOutcome('no',  'No',  entry.no));
  return outcomes.length > 0 ? { market: 'btts', outcomes } : null;
}

function normalizeAsianHandicap(market: OddsApiOddsMarket): NormalizedMarket | null {
  const entry = market.odds[0] as OddsApiOddsEntry | undefined;
  if (!entry) return null;
  const hdp = entry.hdp !== undefined ? String(entry.hdp) : '0';
  const outcomes: NormalizedOutcome[] = [];
  if (entry.home) outcomes.push(toOutcome(`home_${hdp}`, `Home (${hdp})`, entry.home));
  if (entry.away) outcomes.push(toOutcome(`away_${hdp}`, `Away (${hdp})`, entry.away));
  return outcomes.length > 0 ? { market: 'asian_handicap', outcomes } : null;
}

function normalizeMarket(market: OddsApiOddsMarket): NormalizedMarket[] {
  switch (market.name) {
    case 'ML':
      return [normalizeML(market)].filter(Boolean) as NormalizedMarket[];
    case 'Totals':
      return normalizeTotals(market);
    case 'Both Teams to Score':
      return [normalizeBtts(market)].filter(Boolean) as NormalizedMarket[];
    case 'Asian Handicap':
      return [normalizeAsianHandicap(market)].filter(Boolean) as NormalizedMarket[];
    default:
      return [];
  }
}

/**
 * Normalizes odds for the preferred bookmaker (first in the list).
 * Returns null if no bookmaker data is available.
 */
export function normalizeOdds(
  fixtureId: number,
  raw: OddsApiOddsResponse,
  preferredBookmakers: string[],
): NormalizedOdds | null {
  const available = Object.keys(raw.bookmakers);
  const availableByLower = new Map(available.map((name) => [name.toLowerCase(), name]));
  // Pick the first preferred bookmaker that has data (case-insensitive).
  const bookmakerName =
    preferredBookmakers
      .map((b) => availableByLower.get(b.toLowerCase()))
      .find((name): name is string => Boolean(name)) ?? available[0];
  if (!bookmakerName) return null;

  const bookmakerMarkets = raw.bookmakers[bookmakerName];
  if (!bookmakerMarkets?.length) return null;

  const markets: NormalizedMarket[] = [];
  let updatedAt = new Date().toISOString();

  for (const market of bookmakerMarkets) {
    if (market.updatedAt) updatedAt = market.updatedAt;
    markets.push(...normalizeMarket(market));
  }

  return { fixtureId, bookmakerName, updatedAt, markets };
}
