// SportyStake shared types. Used by both Next.js frontend and API routes.
// USDC amounts are stored as decimal strings (e.g. "25.000000") to avoid
// floating-point drift. On-chain values are 6-decimal uint256.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type BetStatus = "PENDING" | "WON" | "LOST" | "CANCELLED" | "CASHED";
export type MarketStatus = "OPEN" | "SUSPENDED" | "LIVE" | "SETTLED" | "CANCELLED";
export type LPStatus = "ACTIVE" | "WITHDRAWAL_REQUESTED" | "SETTLED";
export type QuotaMode = "normal" | "conservation" | "emergency";

export type MarketType =
  | "1X2"
  | "over_under_15"
  | "over_under_25"
  | "over_under_35"
  | "btts"
  | "double_chance"
  | "asian_handicap"
  | "next_team_to_score"
  | "half_time_result";

export interface OddsSelection {
  outcome: number;
  label: string;
  valueX1000: number;
  prevValueX1000?: number;
  movement?: "up" | "down" | "same";
}

export interface OddsBundle {
  marketType: MarketType;
  selections: OddsSelection[];
}

export interface MarketDTO {
  id: string;
  externalId: string;
  fixtureId: number;
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  country: string;
  countryCode: string;
  homeTeam: string;
  homeTeamId: number;
  homeTeamLogo?: string;
  awayTeam: string;
  awayTeamId: number;
  awayTeamLogo?: string;
  startTime: string; // ISO
  status: MarketStatus;
  liveMinute?: number;
  homeScore?: number;
  awayScore?: number;
  winningOutcome?: number;
  poolAddress?: Address;
  poolTvl: string; // USDC decimal string
  poolLocked: string;
  poolBetVolume: string;
  isFeatured: boolean;
  odds: OddsBundle[];
  marketsCount: number;
  events?: MatchEvent[];
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow_card" | "red_card" | "substitution" | "kick_off" | "half_time" | "full_time" | "var";
  team?: "home" | "away";
  player?: string;
  detail?: string;
}

export interface BetDTO {
  id: string;
  userId: string;
  userAddress: Address;
  marketId: string;
  marketLabel: string;
  marketType: MarketType;
  outcome: number;
  selectionLabel: string;
  amount: string; // USDC decimal
  oddsX1000: number;
  potentialPayout: string;
  status: BetStatus;
  isLive: boolean;
  isPublic: boolean;
  parlayId?: string;
  txHash?: string;
  onchainBetId?: string;
  createdAt: string;
  settledAt?: string;
  copyOfBetId?: string;
}

export interface ParlayDTO {
  id: string;
  userId: string;
  legs: BetDTO[];
  totalStake: string;
  combinedOddsX1000: number;
  potentialPayout: string;
  status: BetStatus;
  createdAt: string;
}

export interface LPPositionDTO {
  id: string;
  userId: string;
  userAddress: Address;
  marketId: string;
  marketLabel: string;
  onchainShares: string;
  depositedUsdc: string;
  currentValueUsdc: string;
  status: LPStatus;
  txHash?: string;
  createdAt: string;
  settledAt?: string;
  finalUsdc?: string;
  pnl?: string;
}

export interface PoolStats {
  marketId: string;
  poolAddress?: Address;
  tvl: string;
  totalShares: string;
  locked: string;
  utilization: number; // 0..1
  betVolume: string;
  lpCount: number;
  exposureByOutcome: { outcome: number; label: string; risk: string }[];
  estimatedApy: number; // percent
  health: "safe" | "filling" | "full" | "locked";
  closesAt: string;
}

export interface UserDTO {
  id: string;
  walletAddress: Address;
  username?: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string;
  isPublic: boolean;
  isBanned: boolean;
  roles: ("USER" | "ADMIN" | "OPERATOR")[];
  createdAt: string;
}

export interface UserStats {
  totalBets: number;
  won: number;
  lost: number;
  winRate: number;
  totalWagered: string;
  totalPayout: string;
  netPnl: string;
  currentStreak: number;
  bestStreak: number;
  badges: ("HOT_STREAK" | "HIGH_ROLLER" | "VALUE_BETTOR" | "WHALE" | "PARLAY_KING")[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  walletAddress: Address;
  username?: string;
  bets: number;
  winRate: number;
  volume: string;
  pnl: string;
  streak: number;
}

export interface CasinoGameMeta {
  id: string;
  slug: "crash" | "dice" | "slots" | "blackjack" | "roulette" | "baccarat";
  name: string;
  category: "Crash" | "Dice" | "Slots" | "Table" | "Live";
  houseEdgeBps: number;
  minBet: string;
  maxBet: string;
  description: string;
}

export interface CrashRound {
  id: number;
  status: "waiting" | "running" | "crashed";
  startedAt?: string;
  multiplierX100?: number; // current
  crashMultiplierX100?: number; // when crashed
  players: CrashPlayer[];
  history: number[]; // last 20 crash multipliers X100
}

export interface CrashPlayer {
  address: Address;
  amount: string;
  autoCashoutX100?: number;
  cashedOutAtX100?: number;
  profit?: string;
}

export interface DiceRoll {
  id: string;
  userAddress: Address;
  amount: string;
  target: number; // 1..98
  direction: "over" | "under";
  roll: number;
  win: boolean;
  payout: string;
  createdAt: string;
}

export interface SlotsSpin {
  id: string;
  userAddress: Address;
  amount: string;
  lines: number;
  reels: number[][];
  winLines: number[];
  payout: string;
  createdAt: string;
}

export interface PredictionResult {
  fixtureId: number;
  marketId: string;
  probabilities: { home: number; draw: number; away: number };
  bookmakerImplied: { home: number; draw: number; away: number };
  valueEdge: { outcome: "home" | "draw" | "away"; edge: number } | null;
  factors: string[];
  recommendation: "VALUE_BET" | "AVOID" | "NEUTRAL";
  confidence: number; // 1..5
  explanation: string;
  generatedAt: string;
}

export interface FeedItem {
  id: string;
  type: "bet" | "lp_deposit" | "lp_settle" | "big_win" | "casino_win";
  userAddress: Address;
  username?: string;
  amount: string;
  detail: string;
  marketId?: string;
  createdAt: string;
  likes: number;
}

export interface QuotaStatus {
  used: number;
  remaining: number;
  resetAt: string;
  mode: QuotaMode;
}

export interface ApiResult<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  requestId?: string;
}

export type ApiResponse<T> = ApiResult<T> | ApiError;
