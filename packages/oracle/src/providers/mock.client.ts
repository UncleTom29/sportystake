/**
 * Mock provider — zero real API calls.
 * Activate via USE_MOCK_PROVIDER=true (default in development).
 * Generates realistic events across multiple sports with live scores and odds drift.
 */

import type { OddsApiEvent, OddsApiOddsResponse } from '../types/odds-api.types.js';
import type { IFootballProvider, ProviderStatus } from './provider.interface.js';
import { HOURLY_QUOTA, type QuotaStatus } from '../quota/quota-budget-manager.js';

// ─── static reference data ────────────────────────────────────────────────────

const FOOTBALL_TEAMS = [
  { id: 33,  name: 'Manchester United' },
  { id: 40,  name: 'Liverpool'          },
  { id: 42,  name: 'Arsenal'            },
  { id: 49,  name: 'Chelsea'            },
  { id: 50,  name: 'Manchester City'    },
  { id: 47,  name: 'Tottenham'          },
  { id: 157, name: 'Bayern Munich'      },
  { id: 165, name: 'Borussia Dortmund'  },
  { id: 85,  name: 'PSG'                },
  { id: 80,  name: 'Lyon'               },
  { id: 529, name: 'Barcelona'          },
  { id: 541, name: 'Real Madrid'        },
  { id: 489, name: 'AC Milan'           },
  { id: 505, name: 'Inter Milan'        },
  { id: 496, name: 'Juventus'           },
] as const;

const BASKETBALL_TEAMS = [
  { id: 1001, name: 'LA Lakers' },
  { id: 1002, name: 'Boston Celtics' },
  { id: 1003, name: 'Golden State Warriors' },
  { id: 1004, name: 'Miami Heat' },
  { id: 1005, name: 'Chicago Bulls' },
  { id: 1006, name: 'Brooklyn Nets' },
] as const;

const TENNIS_PLAYERS = [
  { id: 2001, name: 'Novak Djokovic' },
  { id: 2002, name: 'Carlos Alcaraz' },
  { id: 2003, name: 'Jannik Sinner' },
  { id: 2004, name: 'Daniil Medvedev' },
  { id: 2005, name: 'Alexander Zverev' },
  { id: 2006, name: 'Aryna Sabalenka' },
] as const;

const BASEBALL_TEAMS = [
  { id: 3001, name: 'New York Yankees' },
  { id: 3002, name: 'LA Dodgers' },
  { id: 3003, name: 'Houston Astros' },
  { id: 3004, name: 'Atlanta Braves' },
] as const;

interface SportConfig {
  slug: string;
  name: string;
  leagues: { slug: string; name: string }[];
  teams: readonly { id: number; name: string }[];
  hasDrawOdds: boolean;
  eventOffset: number; // base ID offset to avoid collisions
}

const SPORTS: Record<string, SportConfig> = {
  football: {
    slug: 'football',
    name: 'Football',
    leagues: [
      { slug: 'england-premier-league', name: 'England - Premier League' },
      { slug: 'spain-la-liga',          name: 'Spain - La Liga' },
      { slug: 'italy-serie-a',          name: 'Italy - Serie A' },
      { slug: 'germany-bundesliga',     name: 'Germany - Bundesliga' },
      { slug: 'france-ligue-1',         name: 'France - Ligue 1' },
      { slug: 'europe-champions-league',name: 'UEFA Champions League' },
    ],
    teams: FOOTBALL_TEAMS,
    hasDrawOdds: true,
    eventOffset: 900_000,
  },
  basketball: {
    slug: 'basketball',
    name: 'Basketball',
    leagues: [
      { slug: 'usa-nba', name: 'NBA' },
      { slug: 'europe-euroleague', name: 'EuroLeague' },
    ],
    teams: BASKETBALL_TEAMS,
    hasDrawOdds: false,
    eventOffset: 910_000,
  },
  tennis: {
    slug: 'tennis',
    name: 'Tennis',
    leagues: [
      { slug: 'atp-tour', name: 'ATP Tour' },
      { slug: 'wta-tour', name: 'WTA Tour' },
    ],
    teams: TENNIS_PLAYERS,
    hasDrawOdds: false,
    eventOffset: 920_000,
  },
  baseball: {
    slug: 'baseball',
    name: 'Baseball',
    leagues: [
      { slug: 'usa-mlb', name: 'MLB' },
    ],
    teams: BASEBALL_TEAMS,
    hasDrawOdds: false,
    eventOffset: 930_000,
  },
  'american-football': {
    slug: 'american-football',
    name: 'American Football',
    leagues: [
      { slug: 'usa-nfl', name: 'NFL' },
    ],
    teams: [
      { id: 4001, name: 'Kansas City Chiefs' },
      { id: 4002, name: 'San Francisco 49ers' },
      { id: 4003, name: 'Dallas Cowboys' },
      { id: 4004, name: 'Philadelphia Eagles' },
    ],
    hasDrawOdds: false,
    eventOffset: 940_000,
  },
  'ice-hockey': {
    slug: 'ice-hockey',
    name: 'Ice Hockey',
    leagues: [
      { slug: 'usa-nhl', name: 'NHL' },
    ],
    teams: [
      { id: 5001, name: 'Tampa Bay Lightning' },
      { id: 5002, name: 'Colorado Avalanche' },
      { id: 5003, name: 'Vegas Golden Knights' },
      { id: 5004, name: 'Toronto Maple Leafs' },
    ],
    hasDrawOdds: false,
    eventOffset: 950_000,
  },
};

// ─── per-sport mutable state ───────────────────────────────────────────────────

type OddsMap = { home: number; draw: number; away: number; over: number; under: number };

const _state: Record<string, {
  ids: number[];
  scores: [number, number][];
  odds: OddsMap[];
  initialized: boolean;
}> = {};

function rnd(lo: number, hi: number) {
  return parseFloat((lo + Math.random() * (hi - lo)).toFixed(2));
}

function ensureInit(sport: string) {
  if (_state[sport]?.initialized) return;
  const cfg = SPORTS[sport];
  if (!cfg) return;
  const teams = cfg.teams as readonly { id: number; name: string }[];
  const count = Math.min(6, Math.floor(teams.length / 2) * 2);
  _state[sport] = { ids: [], scores: [], odds: [], initialized: true };
  const s = _state[sport];
  for (let i = 0; i < count / 2; i++) {
    const isLive = i < 2;
    s.ids.push(cfg.eventOffset + i);
    s.scores.push(isLive ? [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)] : [0, 0]);
    const homeFav = i % 2 === 0;
    s.odds.push({
      home:  homeFav ? rnd(1.35, 1.9) : rnd(2.0, 3.5),
      draw:  rnd(3.0, 3.8),
      away:  homeFav ? rnd(2.0, 3.5) : rnd(1.35, 1.9),
      over:  rnd(1.72, 2.05),
      under: rnd(1.72, 2.05),
    });
  }
}

function driftOdds(sport: string) {
  const s = _state[sport];
  if (!s) return;
  for (const o of s.odds) {
    for (const k of ['home', 'draw', 'away', 'over', 'under'] as (keyof OddsMap)[]) {
      const delta = (Math.random() - 0.5) * 0.08;
      (o as Record<string, number>)[k] = parseFloat(
        Math.max(1.01, (o as Record<string, number>)[k] + delta).toFixed(2),
      );
    }
  }
}

// ─── event builders ────────────────────────────────────────────────────────────

function buildEventForSport(sport: string, idx: number): OddsApiEvent | null {
  const cfg = SPORTS[sport];
  if (!cfg) return null;
  ensureInit(sport);
  const s = _state[sport];
  if (!s || idx >= s.ids.length) return null;

  const teams = cfg.teams as readonly { id: number; name: string }[];
  const hIdx = (idx * 2) % teams.length;
  const aIdx = (idx * 2 + 1) % teams.length;
  const hm = teams[hIdx];
  const aw = teams[aIdx];
  const lg = cfg.leagues[idx % cfg.leagues.length];
  const now = new Date();
  const isLive = idx < 2;
  const offsetMs = isLive ? -(45 + idx * 15) * 60_000 : (idx * 30 + 60) * 60_000;
  const date = new Date(now.getTime() + offsetMs);
  const status = isLive ? 'live' : (date > now ? 'pending' : 'settled');

  return {
    id: s.ids[idx],
    home: hm.name,
    away: aw.name,
    homeId: hm.id,
    awayId: aw.id,
    date: date.toISOString(),
    status: status as OddsApiEvent['status'],
    sport: { name: cfg.name, slug: cfg.slug },
    league: { name: lg.name, slug: lg.slug },
    scores: isLive ? { home: s.scores[idx][0], away: s.scores[idx][1] } : undefined,
  };
}

function buildOddsForSport(sport: string, idx: number): OddsApiOddsResponse | null {
  const cfg = SPORTS[sport];
  if (!cfg) return null;
  ensureInit(sport);
  driftOdds(sport);
  const s = _state[sport];
  if (!s || idx >= s.ids.length) return null;

  const teams = cfg.teams as readonly { id: number; name: string }[];
  const hm = teams[(idx * 2) % teams.length];
  const aw = teams[(idx * 2 + 1) % teams.length];
  const lg = cfg.leagues[idx % cfg.leagues.length];
  const o = s.odds[idx];
  const now = new Date().toISOString();
  const isLive = idx < 2;

  const mlOdds = cfg.hasDrawOdds
    ? [{ home: String(o.home), draw: String(o.draw), away: String(o.away) }]
    : [{ home: String(o.home), away: String(o.away) }];

  return {
    id: s.ids[idx],
    home: hm.name,
    away: aw.name,
    date: now,
    status: isLive ? 'live' : 'pending',
    sport: { name: cfg.name, slug: cfg.slug },
    league: { name: lg.name, slug: lg.slug },
    bookmakers: {
      Bet365: [
        { name: 'ML', updatedAt: now, odds: mlOdds },
        { name: 'Totals', updatedAt: now, odds: [{ hdp: 2.5, over: String(o.over), under: String(o.under) }] },
      ],
    },
  };
}

// ─── provider implementation ──────────────────────────────────────────────────

export class MockOddsApiClient implements IFootballProvider {
  constructor() {
    for (const sport of Object.keys(SPORTS)) ensureInit(sport);
  }

  getQuotaStatus(): QuotaStatus {
    const resetAt = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), new Date().getUTCHours() + 1),
    ).toISOString();
    return { used: 0, remaining: HOURLY_QUOTA, resetAt, mode: 'normal' };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      account:      { firstname: 'Mock', lastname: 'Dev', email: 'mock@dev.local' },
      subscription: { plan: 'Free (Mock)', end: '2099-12-31', active: true },
      requests:     { current: 0, limit_day: HOURLY_QUOTA },
    };
  }

  async getLiveEvents(sport?: string): Promise<OddsApiEvent[]> {
    const results: OddsApiEvent[] = [];
    const targets = sport ? [sport] : Object.keys(SPORTS);
    for (const slug of targets) {
      ensureInit(slug);
      const s = _state[slug];
      if (!s) continue;
      for (let i = 0; i < s.ids.length; i++) {
        if (i < 2) {
          const evt = buildEventForSport(slug, i);
          if (evt) results.push(evt);
        }
      }
    }
    return results;
  }

  async getUpcomingEvents(sport: string): Promise<OddsApiEvent[]> {
    const cfg = SPORTS[sport];
    if (!cfg) return [];
    ensureInit(sport);
    const s = _state[sport];
    if (!s) return [];
    const results: OddsApiEvent[] = [];
    for (let i = 0; i < s.ids.length; i++) {
      const evt = buildEventForSport(sport, i);
      if (evt) results.push(evt);
    }
    return results;
  }

  async getOddsByEvent(eventId: number, _bookmakers: string[]): Promise<OddsApiOddsResponse | null> {
    for (const sport of Object.keys(SPORTS)) {
      ensureInit(sport);
      const s = _state[sport];
      if (!s) continue;
      const i = s.ids.indexOf(eventId);
      if (i >= 0) return buildOddsForSport(sport, i);
    }
    return null;
  }

  async getMultiOdds(eventIds: number[], _bookmakers: string[]): Promise<OddsApiOddsResponse[]> {
    const results: OddsApiOddsResponse[] = [];
    for (const eventId of eventIds) {
      for (const sport of Object.keys(SPORTS)) {
        ensureInit(sport);
        const s = _state[sport];
        if (!s) continue;
        const i = s.ids.indexOf(eventId);
        if (i >= 0) {
          const odds = buildOddsForSport(sport, i);
          if (odds) results.push(odds);
          break;
        }
      }
    }
    return results;
  }
}
