export interface Selection {
  /** "app": cross-validated against this app's own scraped odds catalog.
   *  "web": sourced from the decide model's own live web search, used when
   *  nothing in our scraped catalog clears the edge bar. Not cross-checked
   *  against any feed we control — verify the odds at the named bookmaker
   *  before placing. */
  source: "app" | "web";
  /** Only present for source: "app" — the real Prisma Market.id it was validated against. */
  marketId?: string;
  match: string;
  leagueName: string;
  sport: string;
  marketType: string;
  outcome?: number;
  label: string;
  oddsDecimal: number;
  startTime: string;
  /** Only present for source: "web" — where the model says it found this line. */
  bookmaker?: string;
  reasoning: string;
}

export type PickVerdict = "BET" | "SKIP";

export interface PicksResult {
  verdict: PickVerdict;
  selections: Selection[];
  combinedOdds: number;
  summary: string;
  skipReason?: string;
}

export type DailyEntryStatus = "pending" | "won" | "lost" | "skipped";

export interface DailyEntry {
  date: string; // ISO date (YYYY-MM-DD)
  day: number; // 1..10
  verdict: PickVerdict;
  selections: Selection[];
  combinedOdds: number;
  stakeUnits: number;
  potentialReturnUnits: number;
  status: DailyEntryStatus;
  summary: string;
}

export type RolloverStatus = "idle" | "active" | "completed";

export interface RolloverState {
  status: RolloverStatus;
  day: number; // 1..10, only meaningful when status === "active" | "completed"
  startDate?: string;
  baseStakeUnits: number;
  bankrollUnits: number;
  history: DailyEntry[];
}

/** A fixture/line the gather-stage (search-grounded) model actually found via
 *  live web search, outside this app's own scraped catalog. The decide stage
 *  may only pick "web" selections from this list — it has no browsing ability
 *  of its own, so letting it invent web-sourced odds would just reintroduce
 *  hallucination under a different label. */
export interface WebCandidate {
  match: string;
  leagueName: string;
  sport: string;
  marketType: string;
  label: string;
  oddsDecimal: number;
  bookmaker: string;
  startTime: string;
  note: string;
}

export interface CandidateMarket {
  marketId: string;
  sport: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  outcomes: {
    marketType: string;
    outcome: number;
    label: string;
    oddsDecimal: number;
    bestBookmaker: string;
    priceSpreadPct: number; // spread between best and worst bookmaker price on this outcome, as a signal of line disagreement
  }[];
}
