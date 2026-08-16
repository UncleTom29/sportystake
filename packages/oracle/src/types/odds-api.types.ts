/**
 * Raw Odds-API.io v3 response shapes used by the oracle.
 */

export type OddsApiEventStatus = 'pending' | 'live' | 'settled' | 'cancelled';

export interface OddsApiEvent {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string; // ISO
  status: OddsApiEventStatus;
  sport: { name: string; slug: string };
  league: { name: string; slug: string };
  scores?: {
    home: number | null;
    away: number | null;
    periods?: Record<string, { home: number; away: number }>;
  };
}

export interface OddsApiOddsEntry {
  home?: string;
  draw?: string;
  away?: string;
  over?: string;
  under?: string;
  hdp?: number | string;
  yes?: string;
  no?: string;
}

export interface OddsApiOddsMarket {
  name: string;
  odds: OddsApiOddsEntry[];
  updatedAt: string;
}

export interface OddsApiOddsResponse {
  id: number;
  home: string;
  away: string;
  date: string;
  status: OddsApiEventStatus;
  sport?: { name: string; slug: string };
  league?: { name: string; slug: string };
  bookmakers: Record<string, OddsApiOddsMarket[]>;
}
