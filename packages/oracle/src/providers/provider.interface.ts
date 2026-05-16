import type {
  ApiFootballFixture,
  ApiFootballOddsResponse,
  ApiFootballPrediction,
  ApiFootballStandingsResponse,
} from '../types/api-football.types.js';
import type { QuotaStatus } from '../quota/quota-budget-manager.js';

export interface IFootballProvider {
  getStatus(): Promise<ProviderStatus>;
  getLiveFixtures(): Promise<ApiFootballFixture[]>;
  getFixturesByDate(dateIso: string): Promise<ApiFootballFixture[]>;
  getFixturesByIds(ids: number[]): Promise<ApiFootballFixture[]>;
  getOddsByFixture(fixtureId: number): Promise<ApiFootballOddsResponse | null>;
  getLiveOdds(fixtureId: number): Promise<ApiFootballOddsResponse | null>;
  getPrediction(fixtureId: number): Promise<ApiFootballPrediction | null>;
  getStandings(leagueId: number, season: number): Promise<ApiFootballStandingsResponse | null>;
  getHeadToHead(homeId: number, awayId: number): Promise<ApiFootballFixture[]>;
  /** Internal quota snapshot — useful for /health. */
  getQuotaStatus(): QuotaStatus;
}

export interface ProviderStatus {
  account: { firstname?: string; lastname?: string; email?: string };
  subscription: { plan: string; end: string; active: boolean };
  requests: { current: number; limit_day: number };
}
