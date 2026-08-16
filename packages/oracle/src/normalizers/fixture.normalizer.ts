import type { OddsApiEvent } from '../types/odds-api.types.js';
import { mapStatus, type MarketStatus } from './status-map.js';

export interface NormalizedFixture {
  fixtureId: number;
  externalId: string;
  sport: string;
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

/** Maps well-known Odds-API league slugs to legacy numeric IDs. */
const LEAGUE_SLUG_TO_ID: Record<string, number> = {
  'england-premier-league': 39,
  'spain-la-liga': 140,
  'italy-serie-a': 135,
  'germany-bundesliga': 78,
  'france-ligue-1': 61,
  'europe-champions-league': 2,
  'europe-uefa-champions-league': 2,
  'europe-europa-league': 3,
  'england-championship': 40,
  'spain-segunda': 141,
  'italy-serie-b': 136,
  'germany-2-bundesliga': 79,
  'france-ligue-2': 62,
};

const SLUG_PREFIX_TO_COUNTRY: Record<string, { name: string; code: string }> = {
  england:     { name: 'England',     code: 'GB' },
  spain:       { name: 'Spain',       code: 'ES' },
  italy:       { name: 'Italy',       code: 'IT' },
  germany:     { name: 'Germany',     code: 'DE' },
  france:      { name: 'France',      code: 'FR' },
  europe:      { name: 'Europe',      code: 'EU' },
  world:       { name: 'World',       code: 'WW' },
  usa:         { name: 'USA',         code: 'US' },
  brazil:      { name: 'Brazil',      code: 'BR' },
  argentina:   { name: 'Argentina',   code: 'AR' },
  portugal:    { name: 'Portugal',    code: 'PT' },
  netherlands: { name: 'Netherlands', code: 'NL' },
  belgium:     { name: 'Belgium',     code: 'BE' },
  turkey:      { name: 'Turkey',      code: 'TR' },
  mexico:      { name: 'Mexico',      code: 'MX' },
  japan:       { name: 'Japan',       code: 'JP' },
};

function leagueIdFromSlug(slug: string): number {
  return LEAGUE_SLUG_TO_ID[slug] ?? hashSlug(slug);
}

function countryFromLeagueSlug(slug: string): { country: string; countryCode: string | null } {
  const prefix = slug.split('-')[0]?.toLowerCase() ?? '';
  const entry = SLUG_PREFIX_TO_COUNTRY[prefix];
  if (entry) return { country: entry.name, countryCode: entry.code };
  return { country: prefix.charAt(0).toUpperCase() + prefix.slice(1), countryCode: null };
}

/** Deterministic numeric ID in range [1_000_000, 1_999_999] for unknown slugs. */
function hashSlug(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return 1_000_000 + (Math.abs(h >>> 0) % 1_000_000);
}

export function normalizeFixture(raw: OddsApiEvent): NormalizedFixture {
  const { country, countryCode } = countryFromLeagueSlug(raw.league.slug);
  return {
    fixtureId: raw.id,
    externalId: `oddsapi:${raw.id}`,
    sport: raw.sport?.slug ?? 'football',
    leagueId: leagueIdFromSlug(raw.league.slug),
    leagueName: raw.league.name,
    leagueLogo: '',
    country,
    countryCode,
    season: new Date(raw.date).getUTCFullYear(),
    round: '',
    homeTeam: raw.home,
    homeTeamId: raw.homeId,
    homeTeamLogo: '',
    awayTeam: raw.away,
    awayTeamId: raw.awayId,
    awayTeamLogo: '',
    startTime: new Date(raw.date),
    status: mapStatus(raw.status),
    rawStatus: raw.status,
    homeScore: raw.scores?.home ?? 0,
    awayScore: raw.scores?.away ?? 0,
    minute: null,
    venue: null,
  };
}

export function normalizeFixtures(events: OddsApiEvent[]): NormalizedFixture[] {
  return events.map(normalizeFixture);
}
