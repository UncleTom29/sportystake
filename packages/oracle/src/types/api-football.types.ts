/**
 * Raw API-Football v3 response shapes used by the oracle.
 * These intentionally match upstream loosely (nullable fields are common).
 */

export interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, string | number>;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

// ---------- /fixtures ----------

export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string; // ISO
    timestamp: number;
    periods: { first: number | null; second: number | null };
    venue: { id: number | null; name: string | null; city: string | null };
    status: {
      long: string;
      short: ApiFootballFixtureStatus;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ApiFootballTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export type ApiFootballFixtureStatus =
  | 'TBD'
  | 'NS'
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'BT'
  | 'P'
  | 'SUSP'
  | 'INT'
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO'
  | 'LIVE';

// ---------- /odds ----------

export interface ApiFootballOddsResponse {
  league: { id: number; name: string; country: string; logo: string; season: number };
  fixture: { id: number; timezone: string; date: string; timestamp: number };
  update: string;
  bookmakers: ApiFootballBookmaker[];
}

export interface ApiFootballBookmaker {
  id: number;
  name: string;
  bets: ApiFootballBet[];
}

export interface ApiFootballBet {
  id: number;
  name: string;
  values: ApiFootballBetValue[];
}

export interface ApiFootballBetValue {
  value: string;
  odd: string;
}

// ---------- /predictions ----------

export interface ApiFootballPrediction {
  predictions: {
    winner: { id: number | null; name: string | null; comment: string | null };
    win_or_draw: boolean;
    under_over: string | null;
    goals: { home: string | null; away: string | null };
    advice: string;
    percent: { home: string; draw: string; away: string };
  };
  league: { id: number; name: string; country: string; logo: string; season: number };
  teams: {
    home: ApiFootballTeam & { last_5: unknown };
    away: ApiFootballTeam & { last_5: unknown };
  };
  comparison: Record<string, unknown>;
  h2h: ApiFootballFixture[];
}

// ---------- /standings ----------

export interface ApiFootballStandingsResponse {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    standings: ApiFootballStandingRow[][];
  };
}

export interface ApiFootballStandingRow {
  rank: number;
  team: ApiFootballTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: ApiFootballStandingStats;
  home: ApiFootballStandingStats;
  away: ApiFootballStandingStats;
  update: string;
}

export interface ApiFootballStandingStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
}
