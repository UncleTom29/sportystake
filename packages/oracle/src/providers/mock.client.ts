/**
 * Mock provider — zero real API calls.
 * Activate via USE_MOCK_PROVIDER=true (default in development).
 * Generates realistic fixtures, live scores, and odds drift.
 */

import type {
  ApiFootballFixture,
  ApiFootballOddsResponse,
  ApiFootballPrediction,
  ApiFootballStandingsResponse,
} from '../types/api-football.types.js';
import type { IFootballProvider, ProviderStatus } from './provider.interface.js';
import type { QuotaStatus } from '../quota/quota-budget-manager.js';

// ─── static reference data ───────────────────────────────────────────────────

const TEAMS = [
  { id: 33,  name: "Manchester United",  logo: "https://media.api-sports.io/football/teams/33.png"  },
  { id: 40,  name: "Liverpool",          logo: "https://media.api-sports.io/football/teams/40.png"  },
  { id: 42,  name: "Arsenal",            logo: "https://media.api-sports.io/football/teams/42.png"  },
  { id: 49,  name: "Chelsea",            logo: "https://media.api-sports.io/football/teams/49.png"  },
  { id: 50,  name: "Manchester City",    logo: "https://media.api-sports.io/football/teams/50.png"  },
  { id: 47,  name: "Tottenham",          logo: "https://media.api-sports.io/football/teams/47.png"  },
  { id: 157, name: "Bayern Munich",      logo: "https://media.api-sports.io/football/teams/157.png" },
  { id: 165, name: "Borussia Dortmund",  logo: "https://media.api-sports.io/football/teams/165.png" },
  { id: 85,  name: "PSG",                logo: "https://media.api-sports.io/football/teams/85.png"  },
  { id: 80,  name: "Lyon",               logo: "https://media.api-sports.io/football/teams/80.png"  },
  { id: 529, name: "Barcelona",          logo: "https://media.api-sports.io/football/teams/529.png" },
  { id: 541, name: "Real Madrid",        logo: "https://media.api-sports.io/football/teams/541.png" },
  { id: 489, name: "AC Milan",           logo: "https://media.api-sports.io/football/teams/489.png" },
  { id: 505, name: "Inter Milan",        logo: "https://media.api-sports.io/football/teams/505.png" },
  { id: 496, name: "Juventus",           logo: "https://media.api-sports.io/football/teams/496.png" },
] as const;

const LEAGUES = [
  { id: 39,  name: "Premier League",         country: "England", season: 2025 },
  { id: 140, name: "La Liga",                country: "Spain",   season: 2025 },
  { id: 135, name: "Serie A",                country: "Italy",   season: 2025 },
  { id: 78,  name: "Bundesliga",             country: "Germany", season: 2025 },
  { id: 61,  name: "Ligue 1",                country: "France",  season: 2025 },
  { id: 2,   name: "UEFA Champions League",  country: "Europe",  season: 2025 },
] as const;

const DEFS = [
  { lg: 0, h: 0, a: 1, live: false },  // Man Utd vs Liverpool
  { lg: 0, h: 2, a: 4, live: true  },  // Arsenal vs Man City (LIVE)
  { lg: 0, h: 3, a: 5, live: false },  // Chelsea vs Spurs
  { lg: 1, h: 10,a: 11,live: false },  // Barça vs Real
  { lg: 2, h: 12,a: 13,live: true  },  // AC Milan vs Inter (LIVE)
  { lg: 2, h: 14,a: 12,live: false },  // Juventus vs Milan
  { lg: 3, h: 6, a: 7, live: true  },  // Bayern vs Dortmund (LIVE)
  { lg: 4, h: 8, a: 9, live: false },  // PSG vs Lyon
  { lg: 5, h: 2, a: 11,live: false },  // Arsenal vs Real (UCL)
  { lg: 5, h: 4, a: 13,live: false },  // Man City vs Inter (UCL)
];

// ─── mutable state (simulates live data changes) ──────────────────────────────

type OddsMap = { home: number; draw: number; away: number; over25: number; under25: number; bttsYes: number };

const _ids: number[]      = [];
const _mins: number[]     = [];
const _scores: [number, number][] = [];
const _odds: OddsMap[]    = [];
let _initialized           = false;

function rnd(lo: number, hi: number) { return parseFloat((lo + Math.random() * (hi - lo)).toFixed(2)); }

function init() {
  if (_initialized) return;
  _initialized = true;
  const base = 900_000;
  DEFS.forEach((d, i) => {
    _ids.push(base + i);
    _mins.push(d.live ? 45 + Math.floor(Math.random() * 40) : 0);
    _scores.push(d.live ? [Math.floor(Math.random() * 2), Math.floor(Math.random() * 2)] : [0, 0]);
    const homeFav = i % 3 !== 0;
    _odds.push({
      home:    homeFav ? rnd(1.35, 1.9)  : rnd(2.5, 5.0),
      draw:    rnd(3.0, 3.8),
      away:    homeFav ? rnd(3.0, 5.5)   : rnd(1.35, 1.9),
      over25:  rnd(1.72, 2.05),
      under25: rnd(1.72, 2.05),
      bttsYes: rnd(1.55, 1.90),
    });
  });
}

function driftOdds() {
  for (const o of _odds) {
    for (const k of ["home", "draw", "away", "over25", "under25"] as (keyof OddsMap)[]) {
      const delta = (Math.random() - 0.5) * 0.08;
      (o as Record<string, number>)[k] = parseFloat(Math.max(1.01, (o as Record<string, number>)[k] + delta).toFixed(2));
    }
  }
}

function tickLive() {
  DEFS.forEach((d, i) => {
    if (!d.live) return;
    _mins[i] = Math.min(90, _mins[i] + 3);
    if (Math.random() < 0.07) {
      const s = Math.random() < 0.5 ? 0 : 1;
      _scores[i] = [_scores[i][0] + (s === 0 ? 1 : 0), _scores[i][1] + (s === 1 ? 1 : 0)];
    }
  });
}

// ─── builders ────────────────────────────────────────────────────────────────

function buildFixture(i: number): ApiFootballFixture {
  const d   = DEFS[i];
  const lg  = LEAGUES[d.lg];
  const hm  = TEAMS[d.h];
  const aw  = TEAMS[d.a];
  const now = new Date();
  const minsFromNow = d.live ? -(_mins[i]) : (i * 25 + 60);
  const date = new Date(now.getTime() + minsFromNow * 60 * 1000);
  const short: string = d.live ? (_mins[i] > 45 ? "2H" : "1H") : (date > now ? "NS" : "FT");

  return {
    fixture: {
      id:       _ids[i],
      referee:  null,
      timezone: "UTC",
      date:     date.toISOString(),
      timestamp: Math.floor(date.getTime() / 1000),
      periods:  { first: d.live ? Math.floor(date.getTime() / 1000) : null, second: null },
      venue:    { id: null, name: null, city: null },
      status:   { long: short, short: short as ApiFootballFixture["fixture"]["status"]["short"], elapsed: d.live ? _mins[i] : null },
    },
    league: {
      id:      lg.id,
      name:    lg.name,
      country: lg.country,
      logo:    `https://media.api-sports.io/football/leagues/${lg.id}.png`,
      flag:    null,
      season:  lg.season,
      round:   "Regular Season - 35",
    },
    teams: {
      home: { id: hm.id, name: hm.name, logo: hm.logo, winner: null },
      away: { id: aw.id, name: aw.name, logo: aw.logo, winner: null },
    },
    goals: { home: d.live ? _scores[i][0] : null, away: d.live ? _scores[i][1] : null },
    score: {
      halftime:  { home: null, away: null },
      fulltime:  { home: d.live ? _scores[i][0] : null, away: d.live ? _scores[i][1] : null },
      extratime: { home: null, away: null },
      penalty:   { home: null, away: null },
    },
  };
}

function buildOddsResponse(i: number): ApiFootballOddsResponse {
  const o = _odds[i];
  const now = new Date().toISOString();
  return {
    fixture: { id: _ids[i], timezone: "UTC", date: now, timestamp: Math.floor(Date.now() / 1000) },
    league:  { id: LEAGUES[DEFS[i].lg].id, name: LEAGUES[DEFS[i].lg].name, country: LEAGUES[DEFS[i].lg].country, logo: "", season: 2025 },
    update:  now,
    bookmakers: [
      {
        id:   6,
        name: "Bet365",
        bets: [
          {
            id:   1,
            name: "Match Winner",
            values: [
              { value: "Home", odd: String(o.home) },
              { value: "Draw", odd: String(o.draw) },
              { value: "Away", odd: String(o.away) },
            ],
          },
          {
            id:   5,
            name: "Goals Over/Under",
            values: [
              { value: "Over 2.5",  odd: String(o.over25) },
              { value: "Under 2.5", odd: String(o.under25) },
            ],
          },
          {
            id:   74,
            name: "Both Teams Score",
            values: [
              { value: "Yes", odd: String(o.bttsYes) },
              { value: "No",  odd: String(parseFloat((3.8 - o.bttsYes).toFixed(2))) },
            ],
          },
        ],
      },
    ],
  };
}

// ─── provider implementation ─────────────────────────────────────────────────

export class MockApiFootballClient implements IFootballProvider {
  constructor() { init(); }

  getQuotaStatus(): QuotaStatus {
    return { used: 0, remaining: 100, resetAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).toISOString(), mode: "normal" };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      account:      { firstname: "Mock", lastname: "Dev", email: "mock@dev.local" },
      subscription: { plan: "Free (Mock)", end: "2099-12-31", active: true },
      requests:     { current: 0, limit_day: 100 },
    };
  }

  async getLiveFixtures(): Promise<ApiFootballFixture[]> {
    init();
    tickLive();
    driftOdds();
    return DEFS.map((d, i) => ({ d, i })).filter(({ d }) => d.live).map(({ i }) => buildFixture(i));
  }

  async getFixturesByDate(_date: string): Promise<ApiFootballFixture[]> {
    init();
    return DEFS.map((_, i) => buildFixture(i));
  }

  async getFixturesByIds(ids: number[]): Promise<ApiFootballFixture[]> {
    init();
    return DEFS.map((_, i) => buildFixture(i)).filter((f) => ids.includes(f.fixture.id));
  }

  async getOddsByFixture(fixtureId: number): Promise<ApiFootballOddsResponse | null> {
    init();
    driftOdds();
    const i = _ids.indexOf(fixtureId);
    return i >= 0 ? buildOddsResponse(i) : null;
  }

  async getLiveOdds(fixtureId: number): Promise<ApiFootballOddsResponse | null> {
    return this.getOddsByFixture(fixtureId);
  }

  async getPrediction(fixtureId: number): Promise<ApiFootballPrediction | null> {
    const i = _ids.indexOf(fixtureId);
    if (i < 0) return null;
    const o = _odds[i];
    const hm = TEAMS[DEFS[i].h];
    const aw = TEAMS[DEFS[i].a];
    const lg = LEAGUES[DEFS[i].lg];
    const homeProb = Math.round((1 / o.home) * 100);
    return {
      predictions: {
        winner:      { id: hm.id, name: hm.name, comment: "Strong home form in recent fixtures" },
        win_or_draw: homeProb > 50,
        under_over:  o.over25 < 1.90 ? "+2.5" : "-2.5",
        goals:       { home: "1.6", away: "1.1" },
        advice:      homeProb > 50 ? "Home win recommended" : "Value on the away side",
        percent:     { home: `${homeProb}%`, draw: "27%", away: `${100 - homeProb - 27}%` },
      },
      league: { id: lg.id, name: lg.name, country: lg.country, logo: `https://media.api-sports.io/football/leagues/${lg.id}.png`, season: lg.season },
      teams: {
        home: { id: hm.id, name: hm.name, logo: hm.logo, winner: null, last_5: null },
        away: { id: aw.id, name: aw.name, logo: aw.logo, winner: null, last_5: null },
      },
      comparison: {},
      h2h: DEFS.slice(0, 2).map((_, j) => buildFixture(j)),
    };
  }

  async getStandings(_leagueId: number, _season: number): Promise<ApiFootballStandingsResponse | null> {
    return null; // Mock doesn't generate full standings tables
  }

  async getHeadToHead(_homeId: number, _awayId: number): Promise<ApiFootballFixture[]> {
    init();
    return DEFS.slice(0, 3).map((_, i) => buildFixture(i));
  }
}
