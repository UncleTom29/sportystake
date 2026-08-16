/**
 * scrape.normalizer.ts
 *
 * Converts raw output rows from the 1xbet scraper (xbet_full.py) into the
 * canonical NormalizedFixture / NormalizedOdds shapes used throughout the
 * oracle. Single-provider (1xbet), so there's no cross-source dedup logic.
 */

import type { NormalizedFixture } from './fixture.normalizer.js';
import type { NormalizedOdds } from './odds.normalizer.js';

export interface ScraperOutcome {
  key: string;
  label: string;
  odds: number;
}

export interface ScraperMarket {
  key: string;
  label: string;
  outcomes: ScraperOutcome[];
}

/** Raw row shape emitted by xbet_full.py. */
export interface ScraperRow {
  bookmaker: string;
  match_id: string;
  match: string;          // "Home Team vs Away Team"
  sport?: string;         // e.g. "Football", "Tennis"
  league: string;         // e.g. "Italy. Serie A" or "Premier League"
  country?: string;       // 1xbet's CN field — may be empty
  home_odds: number;
  draw_odds: number | null;
  away_odds: number;
  match_time: string;     // ISO-8601 UTC ("YYYY-MM-DDTHH:MM:SSZ")
  markets: ScraperMarket[];
  live_score?: string;
  live_status?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** djb2 hash → unsigned int in [1_000_000, 1_999_999]. */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) % 1_000_000 + 1_000_000;
}

/** Parse a UTC ISO-8601 timestamp; fall back to "+24h" so a malformed row
 *  doesn't fail the upsert (it gets caught by the closesAt check instead). */
function parseMatchTime(mt: string): Date {
  if (!mt) return new Date(Date.now() + 86_400_000);
  const d = new Date(mt);
  return Number.isNaN(d.getTime()) ? new Date(Date.now() + 86_400_000) : d;
}

function splitMatch(match: string): { home: string; away: string } {
  const idx = match.indexOf(' vs ');
  if (idx !== -1) return { home: match.slice(0, idx).trim(), away: match.slice(idx + 4).trim() };
  return { home: match.trim(), away: '' };
}

/** External ID is always `1xbet:<match_id>` — single provider. */
function externalIdFor(matchId: string): string {
  return `1xbet:${matchId}`;
}

/** Sport name → kebab-case slug matching the sport-icon registry. */
const SPORT_ALIASES: Record<string, string> = {
  soccer: 'football',
};

function normaliseSport(raw: string | undefined): string {
  if (!raw) return 'football';
  const slug = raw.toLowerCase().replace(/\s+/g, '-');
  return SPORT_ALIASES[slug] ?? slug;
}

/** Country derivation: prefer the CN field, fall back to the "X. League"
 *  prefix that 1xbet bakes into many league names. */
function deriveCountry(country: string | undefined, leagueName: string): string {
  if (country && country.trim()) return country.trim();
  const dot = leagueName.indexOf('.');
  if (dot !== -1) return leagueName.slice(0, dot).trim();
  return 'International';
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Convert a single 1xbet scraper row to a NormalizedFixture. */
export function scraperRowToFixture(row: ScraperRow): NormalizedFixture {
  const { home, away } = splitMatch(row.match);
  const startTime = parseMatchTime(row.match_time);
  const leagueName = row.league || 'Unknown';
  const country = deriveCountry(row.country, leagueName);
  const leagueId = hashStr(leagueName);

  return {
    fixtureId: parseInt(row.match_id, 10),
    externalId: externalIdFor(row.match_id),
    sport: normaliseSport(row.sport),
    leagueId,
    leagueName,
    leagueLogo: '',
    country,
    countryCode: null,
    season: new Date().getFullYear(),
    round: '',
    homeTeam: home,
    homeTeamId: hashStr(home),
    homeTeamLogo: '',
    awayTeam: away,
    awayTeamId: hashStr(away),
    awayTeamLogo: '',
    startTime,
    status: 'OPEN',
    rawStatus: 'Not Started',
    homeScore: 0,
    awayScore: 0,
    minute: null,
    venue: null,
  };
}

/** Raw row shape emitted by xbet_live.py. */
export interface ScraperLiveRow {
  match_id: string;
  match: string;           // "Home Team vs Away Team"
  sport?: string;
  league: string;
  country?: string;
  match_time: string;      // ISO-8601 UTC, may be empty
  score: { home: number; away: number };
  minute: number | null;
  finished: boolean;
}

/** Convert a single 1xbet live-feed row to a NormalizedFixture.
 *
 * Needed because a fixture can go live without ever appearing in a prematch
 * snapshot (already in-play when the oracle starts, or dropped from the
 * prematch feed the instant it kicks off) — without this, the sync-worker's
 * `market:live` handler had nothing to `upsert` and silently no-op'd against
 * a Market row that never existed. Uses the same id-derivation as
 * `scraperRowToFixture` so a fixture seen via both paths converges on
 * identical leagueId/homeTeamId/awayTeamId. */
export function scraperLiveRowToFixture(row: ScraperLiveRow): NormalizedFixture {
  const { home, away } = splitMatch(row.match);
  const startTime = parseMatchTime(row.match_time);
  const leagueName = row.league || 'Unknown';
  const country = deriveCountry(row.country, leagueName);
  const leagueId = hashStr(leagueName);

  return {
    fixtureId: parseInt(row.match_id, 10),
    externalId: externalIdFor(row.match_id),
    sport: normaliseSport(row.sport),
    leagueId,
    leagueName,
    leagueLogo: '',
    country,
    countryCode: null,
    season: new Date().getFullYear(),
    round: '',
    homeTeam: home,
    homeTeamId: hashStr(home),
    homeTeamLogo: '',
    awayTeam: away,
    awayTeamId: hashStr(away),
    awayTeamLogo: '',
    startTime,
    status: row.finished ? 'FINISHED' : 'LIVE',
    rawStatus: row.finished ? 'Finished' : 'Live',
    homeScore: row.score.home,
    awayScore: row.score.away,
    minute: row.minute,
    venue: null,
  };
}

/** Convert a 1xbet scraper row's markets[] into the canonical NormalizedOdds
 *  shape. Each market becomes one entry in `markets`; each outcome carries the
 *  label + integer-x1000 odds the smart contract expects. */
export function scraperRowToOdds(row: ScraperRow): NormalizedOdds {
  return {
    fixtureId: parseInt(row.match_id, 10),
    bookmakerName: row.bookmaker,
    updatedAt: new Date().toISOString(),
    markets: (row.markets ?? []).map((m) => ({
      market: m.key,
      outcomes: m.outcomes.map((o) => ({
        key: o.key,
        label: o.label,
        decimal: o.odds,
        valueX1000: Math.round(o.odds * 1000),
      })),
    })),
  };
}
