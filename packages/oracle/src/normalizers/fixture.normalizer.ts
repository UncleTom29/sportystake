import type { ApiFootballFixture } from '../types/api-football.types.js';
import { mapStatus, type MarketStatus } from './status-map.js';

export interface NormalizedFixture {
  fixtureId: number;
  externalId: string;
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  country: string;
  countryCode: string | null;
  season: number;
  round: string;
  homeTeam: string;
  homeTeamId: number;
  homeTeamLogo: string;
  awayTeam: string;
  awayTeamId: number;
  awayTeamLogo: string;
  startTime: Date;
  status: MarketStatus;
  rawStatus: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  venue: string | null;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  England: 'GB',
  Spain: 'ES',
  Italy: 'IT',
  Germany: 'DE',
  France: 'FR',
  World: 'WW',
  Europe: 'EU',
  Africa: 'AF',
  Brazil: 'BR',
  Argentina: 'AR',
  Portugal: 'PT',
  Netherlands: 'NL',
  Belgium: 'BE',
  Turkey: 'TR',
  USA: 'US',
  Mexico: 'MX',
  Japan: 'JP',
  'Saudi Arabia': 'SA',
};

function resolveCountryCode(country: string, flag: string | null): string | null {
  if (COUNTRY_CODE_MAP[country]) return COUNTRY_CODE_MAP[country];
  if (flag) {
    const m = flag.match(/\/flags\/([a-z]{2})\.svg$/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function normalizeFixture(raw: ApiFootballFixture): NormalizedFixture {
  const rawStatus = raw.fixture.status.short;
  return {
    fixtureId: raw.fixture.id,
    externalId: `apifootball:${raw.fixture.id}`,
    leagueId: raw.league.id,
    leagueName: raw.league.name,
    leagueLogo: raw.league.logo,
    country: raw.league.country,
    countryCode: resolveCountryCode(raw.league.country, raw.league.flag),
    season: raw.league.season,
    round: raw.league.round,
    homeTeam: raw.teams.home.name,
    homeTeamId: raw.teams.home.id,
    homeTeamLogo: raw.teams.home.logo,
    awayTeam: raw.teams.away.name,
    awayTeamId: raw.teams.away.id,
    awayTeamLogo: raw.teams.away.logo,
    startTime: new Date(raw.fixture.date),
    status: mapStatus(rawStatus),
    rawStatus,
    homeScore: raw.goals.home ?? 0,
    awayScore: raw.goals.away ?? 0,
    minute: raw.fixture.status.elapsed,
    venue: raw.fixture.venue.name,
  };
}

export function normalizeFixtures(items: ApiFootballFixture[]): NormalizedFixture[] {
  return items.map(normalizeFixture);
}
