// SportyStake shared types. Used by both Next.js frontend and API routes.
// USDC amounts are stored as decimal strings (e.g. "25.000000") to avoid
// floating-point drift. On-chain values are 6-decimal uint256.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type BetStatus = "PENDING" | "WON" | "LOST" | "CANCELLED" | "CLAIMED" | "REFUNDED";
export type MarketStatus = "OPEN" | "SUSPENDED" | "LIVE" | "SETTLED" | "CANCELLED";
export type LPStatus = "ACTIVE" | "WITHDRAW_REQUESTED" | "WITHDRAWN";
export type QuotaMode = "normal" | "conservation" | "emergency";

export type MarketType =
  | "1X2"
  | "binary"
  | "multi_outcome"
  | "over_under_15"
  | "over_under_25"
  | "over_under_35"
  | "btts"
  | "double_chance"
  | "asian_handicap"
  | "next_team_to_score"
  | "half_time_result"
  | "draw_no_bet"
  | (string & {});

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

export interface BookmakerOddsEntry {
  bookmaker: string;
  marketType: MarketType;
  selections: OddsSelection[];
  capturedAt: string; // ISO
}

export interface MarketDTO {
  id: string;
  externalId: string;
  fixtureId: number;
  sport: string;
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
  closesAt: string; // ISO — the on-chain BettingCore.Market.closesAt this market would register with
  status: MarketStatus;
  liveMinute?: number;
  homeScore?: number;
  awayScore?: number;
  winningOutcome?: number;
  isFeatured: boolean;
  metadata?: Record<string, unknown>;
  odds: OddsBundle[];
  bookmakerOdds: BookmakerOddsEntry[];
  marketsCount: number;
  events?: MatchEvent[];
  /**
   * Present only when this market isn't registered on BettingCore yet.
   * Forward it unchanged into placeBetWithAttestation/
   * placeParlayBetWithAttestations — the contract verifies the signature
   * itself, the client never needs to interpret it.
   */
  attestation?: MarketAttestationDTO;
}

export interface MarketAttestationDTO {
  marketId: string;
  closesAt: number;
  validUntil: number;
  signature: string;
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
  /** True when this row is a CasinoBet (Aviator/Dice/Slots/…), not a
   *  BettingCore sports bet or parlay — no on-chain BettingCore betId
   *  exists for it, so the frontend must not offer a claimWinnings()
   *  action for these regardless of `status`. */
  isCasino?: boolean;
  /** Present only when this row represents a parlay (parlayId is set) —
   *  one entry per leg, so bet history can show the individual matches
   *  played rather than just a flattened "N-Leg Parlay" summary. */
  legs?: {
    marketId: string;
    marketLabel: string;
    /** Undefined for legs placed before this was captured (see
     *  prisma/schema.prisma's ParlayLeg.marketType) — never guessed. */
    marketType?: string;
    selectionLabel: string;
    oddsX1000: number;
    result: "PENDING" | "WON" | "LOST" | "VOID";
    matchTime: string;
    homeTeam: string;
    awayTeam: string;
    homeScore?: number;
    awayScore?: number;
    marketStatus: string;
  }[];
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

/** One user's position in the single, protocol-wide LiquidityPool. */
export interface LPPositionDTO {
  id: string;
  userId: string;
  userAddress: Address;
  onchainShares: string;
  depositedUsdc: string;
  currentValueUsdc: string;
  status: LPStatus;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate stats for the single, protocol-wide LiquidityPool. */
export interface PoolStats {
  tvl: string; // real LP-deposited USDC (totalLiquidity)
  totalShares: string;
  locked: string; // lockedForPayouts, across every open market
  virtualLiquidity: string; // protocol-funded capacity credit
  effectiveCapacity: string; // tvl + virtualLiquidity
  utilization: number; // 0..1, locked / effectiveCapacity
  shareValue: string;
  lpCount: number;
  estimatedApy: number; // percent
}

/** Per-market slice of the shared pool's exposure — used by the risk dashboard. */
export interface MarketExposureDTO {
  marketId: string;
  label: string;
  closesAt: string;
  totalBetAmount: string;
  maxLiability: string;
  coverageRatio: number; // maxLiability / effectiveCapacity
  riskLevel: "safe" | "warning" | "critical";
}

export interface UserDTO {
  id: string;
  walletAddress: Address;
  username?: string;
  avatar?: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string;
  referredById?: string;
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
