import type {
  ApiFootballBet,
  ApiFootballBookmaker,
  ApiFootballOddsResponse,
} from '../types/api-football.types.js';

export type MarketKey =
  | '1X2'
  | 'over_under_15'
  | 'over_under_25'
  | 'over_under_35'
  | 'btts'
  | 'double_chance'
  | 'asian_handicap';

export interface NormalizedOutcome {
  /** Stable machine key, e.g. '1', 'X', '2', 'Over', 'Under 2.5'. */
  key: string;
  /** Human label as supplied by API-Football. */
  label: string;
  /** Decimal odds. */
  decimal: number;
  /** Decimal odds * 1000 (integer) — what we publish on-chain & internally. */
  valueX1000: number;
}

export interface NormalizedMarket {
  market: MarketKey;
  outcomes: NormalizedOutcome[];
}

export interface NormalizedOdds {
  fixtureId: number;
  bookmakerId: number;
  bookmakerName: string;
  updatedAt: string;
  markets: NormalizedMarket[];
}

const BET_NAME_TO_MARKET: Record<string, MarketKey> = {
  'Match Winner': '1X2',
  '1X2': '1X2',
  'Goals Over/Under': 'over_under_25', // refined per line below
  'Both Teams Score': 'btts',
  'Both Teams To Score': 'btts',
  'Double Chance': 'double_chance',
  'Asian Handicap': 'asian_handicap',
};

function parseDecimal(odd: string): number {
  const n = Number.parseFloat(odd);
  if (!Number.isFinite(n) || n <= 1) return 1.01;
  return n;
}

function toOutcome(key: string, label: string, odd: string): NormalizedOutcome {
  const decimal = parseDecimal(odd);
  return {
    key,
    label,
    decimal,
    valueX1000: Math.round(decimal * 1000),
  };
}

function normalize1X2(bet: ApiFootballBet): NormalizedMarket {
  const map: Record<string, string> = { Home: '1', Draw: 'X', Away: '2' };
  return {
    market: '1X2',
    outcomes: bet.values.map((v) =>
      toOutcome(map[v.value] ?? v.value, v.value, v.odd),
    ),
  };
}

function normalizeOverUnder(bet: ApiFootballBet): NormalizedMarket[] {
  // API-Football returns rows like { value: 'Over 1.5', odd: '...' }
  const buckets: Record<string, NormalizedOutcome[]> = {
    over_under_15: [],
    over_under_25: [],
    over_under_35: [],
  };
  for (const v of bet.values) {
    const m = /^(Over|Under)\s+(\d+(?:\.\d+)?)/.exec(v.value);
    if (!m) continue;
    const side = m[1]; // Over | Under
    const line = m[2];
    let bucket: keyof typeof buckets | null = null;
    if (line === '1.5' || line === '1') bucket = 'over_under_15';
    else if (line === '2.5' || line === '2') bucket = 'over_under_25';
    else if (line === '3.5' || line === '3') bucket = 'over_under_35';
    if (!bucket) continue;
    buckets[bucket].push(toOutcome(side, v.value, v.odd));
  }
  return (Object.keys(buckets) as MarketKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ market: k, outcomes: buckets[k] }));
}

function normalizeBtts(bet: ApiFootballBet): NormalizedMarket {
  return {
    market: 'btts',
    outcomes: bet.values.map((v) =>
      toOutcome(v.value.toLowerCase() === 'yes' ? 'yes' : 'no', v.value, v.odd),
    ),
  };
}

function normalizeDoubleChance(bet: ApiFootballBet): NormalizedMarket {
  const map: Record<string, string> = {
    'Home/Draw': '1X',
    'Home/Away': '12',
    'Draw/Away': 'X2',
  };
  return {
    market: 'double_chance',
    outcomes: bet.values.map((v) =>
      toOutcome(map[v.value] ?? v.value, v.value, v.odd),
    ),
  };
}

function normalizeAsianHandicap(bet: ApiFootballBet): NormalizedMarket {
  return {
    market: 'asian_handicap',
    outcomes: bet.values.map((v) => toOutcome(v.value, v.value, v.odd)),
  };
}

function normalizeBet(bet: ApiFootballBet): NormalizedMarket[] {
  switch (bet.name) {
    case 'Match Winner':
    case '1X2':
      return [normalize1X2(bet)];
    case 'Goals Over/Under':
      return normalizeOverUnder(bet);
    case 'Both Teams Score':
    case 'Both Teams To Score':
      return [normalizeBtts(bet)];
    case 'Double Chance':
      return [normalizeDoubleChance(bet)];
    case 'Asian Handicap':
      return [normalizeAsianHandicap(bet)];
    default: {
      const market = BET_NAME_TO_MARKET[bet.name];
      if (!market) return [];
      return [{ market, outcomes: bet.values.map((v) => toOutcome(v.value, v.value, v.odd)) }];
    }
  }
}

export function normalizeOdds(
  fixtureId: number,
  raw: ApiFootballOddsResponse,
  preferredBookmakerId: number,
): NormalizedOdds | null {
  const bookmaker: ApiFootballBookmaker | undefined =
    raw.bookmakers.find((b) => b.id === preferredBookmakerId) ?? raw.bookmakers[0];
  if (!bookmaker) return null;

  const markets: NormalizedMarket[] = [];
  for (const bet of bookmaker.bets) {
    markets.push(...normalizeBet(bet));
  }

  return {
    fixtureId,
    bookmakerId: bookmaker.id,
    bookmakerName: bookmaker.name,
    updatedAt: raw.update,
    markets,
  };
}
