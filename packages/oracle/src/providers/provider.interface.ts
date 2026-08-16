import type { OddsApiEvent, OddsApiOddsResponse } from '../types/odds-api.types.js';
import type { QuotaStatus } from '../quota/quota-budget-manager.js';

export interface IFootballProvider {
  getStatus(): Promise<ProviderStatus>;
  getLiveEvents(sport?: string): Promise<OddsApiEvent[]>;
  getUpcomingEvents(sport: string): Promise<OddsApiEvent[]>;
  getOddsByEvent(eventId: number, bookmakers: string[]): Promise<OddsApiOddsResponse | null>;
  getMultiOdds(eventIds: number[], bookmakers: string[]): Promise<OddsApiOddsResponse[]>;
  getQuotaStatus(): QuotaStatus;
}

export interface ProviderStatus {
  account: { firstname?: string; lastname?: string; email?: string };
  subscription: { plan: string; end: string; active: boolean };
  requests: { current: number; limit_day: number };
}
