// Singleton in-memory data store for the SportyStake backend.
// Persists across HMR via globalThis. Seeds fixtures, users, bets, LP positions,
// and runs lightweight background simulators (live minute ticks, odds drift,
// crash rounds, feed events) so the frontend has a live, lifelike experience
// without any external dependencies.

import type {
  MarketDTO,
  BetDTO,
  ParlayDTO,
  LPPositionDTO,
  UserDTO,
  PoolStats,
  CrashRound,
  DiceRoll,
  SlotsSpin,
  FeedItem,
  PredictionResult,
  QuotaStatus,
  OddsBundle,
  Address,
  MarketStatus,
  BetStatus,
  UserStats,
  LeaderboardEntry,
  CasinoGameMeta,
} from "@/lib/types";
import { publish } from "@/lib/server/event-bus";
import { shortId, referralCode } from "@/lib/uid";

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

interface RefreshEntry {
  token: string;
  userId: string;
  expiresAt: number;
}

interface StoreState {
  users: UserDTO[];
  markets: MarketDTO[];
  bets: BetDTO[];
  parlays: ParlayDTO[];
  lpPositions: LPPositionDTO[];
  casinoGames: CasinoGameMeta[];
  diceHistory: DiceRoll[];
  slotsHistory: SlotsSpin[];
  feed: FeedItem[];
  currentCrash: CrashRound;
  crashHistory: CrashRound[];
  follows: { followerId: string; followingId: string; at: number }[];
  notifications: { id: string; userId: string; type: string; message: string; createdAt: string; read: boolean }[];
  auditLog: { id: string; actor: string; action: string; target?: string; at: string; details?: unknown }[];
  nonces: Map<string, NonceEntry>;
  refreshTokens: Map<string, RefreshEntry>;
  predictionCache: Map<number, { result: PredictionResult; expiresAt: number }>;
  quota: QuotaStatus;
  rateLimits: Map<string, { count: number; resetAt: number }>;
  poolBetsTracker: Map<string, { totalBet: bigint; totalPayout: bigint }>;
  bootstrapped: boolean;
}

declare global {

  var __ss_store__: StoreState | undefined;
}

// --- helpers --------------------------------------------------------------

const USDC_SCALE = 1_000_000n;
function fromUsdc(s: string): bigint {
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * USDC_SCALE + BigInt(padded || "0");
}
function toUsdc(n: bigint): string {
  const whole = n / USDC_SCALE;
  const frac = (n % USDC_SCALE).toString().padStart(6, "0");
  return `${whole.toString()}.${frac}`;
}
function fmtUsdcShort(n: bigint): string {
  const whole = n / USDC_SCALE;
  const frac = (n % USDC_SCALE).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toString()}.${frac}`;
}

function randAddr(): Address {
  const hex = Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  return `0x${hex}` as Address;
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- seed data ------------------------------------------------------------

type Seed = {
  ext: string;
  league: string;
  leagueId: number;
  country: string;
  countryCode: string;
  home: string;
  homeId: number;
  away: string;
  awayId: number;
  hoursFromNow: number;
  status: MarketStatus;
  liveMinute?: number;
  homeScore?: number;
  awayScore?: number;
  homeStrength: number; // 1..10
  awayStrength: number;
  featured?: boolean;
};

const SEEDS: Seed[] = [
  { ext: "fx-101", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Arsenal", homeId: 42, away: "Manchester City", awayId: 50, hoursFromNow: 4, status: "OPEN", homeStrength: 8.5, awayStrength: 9.2, featured: true },
  { ext: "fx-102", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Chelsea", homeId: 49, away: "Liverpool", awayId: 40, hoursFromNow: 0, status: "LIVE", liveMinute: 67, homeScore: 1, awayScore: 1, homeStrength: 8, awayStrength: 8.8, featured: true },
  { ext: "fx-103", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Manchester United", homeId: 33, away: "Tottenham", awayId: 47, hoursFromNow: 25, status: "OPEN", homeStrength: 7.6, awayStrength: 7.8 },
  { ext: "fx-104", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Newcastle", homeId: 34, away: "Aston Villa", awayId: 66, hoursFromNow: 27, status: "OPEN", homeStrength: 7.4, awayStrength: 7.6 },
  { ext: "fx-201", league: "La Liga", leagueId: 140, country: "Spain", countryCode: "ESP", home: "Real Madrid", homeId: 541, away: "Barcelona", awayId: 529, hoursFromNow: 5, status: "OPEN", homeStrength: 9.4, awayStrength: 9.2, featured: true },
  { ext: "fx-202", league: "La Liga", leagueId: 140, country: "Spain", countryCode: "ESP", home: "Atletico Madrid", homeId: 530, away: "Sevilla", awayId: 536, hoursFromNow: 0, status: "LIVE", liveMinute: 34, homeScore: 0, awayScore: 1, homeStrength: 8.4, awayStrength: 7.2 },
  { ext: "fx-203", league: "La Liga", leagueId: 140, country: "Spain", countryCode: "ESP", home: "Real Sociedad", homeId: 548, away: "Villarreal", awayId: 533, hoursFromNow: 28, status: "OPEN", homeStrength: 7.6, awayStrength: 7.4 },
  { ext: "fx-301", league: "Serie A", leagueId: 135, country: "Italy", countryCode: "ITA", home: "Inter", homeId: 505, away: "Juventus", awayId: 496, hoursFromNow: 6, status: "OPEN", homeStrength: 8.8, awayStrength: 8.2, featured: true },
  { ext: "fx-302", league: "Serie A", leagueId: 135, country: "Italy", countryCode: "ITA", home: "AC Milan", homeId: 489, away: "Napoli", awayId: 492, hoursFromNow: 0, status: "LIVE", liveMinute: 22, homeScore: 1, awayScore: 0, homeStrength: 8.2, awayStrength: 8.6 },
  { ext: "fx-303", league: "Serie A", leagueId: 135, country: "Italy", countryCode: "ITA", home: "Roma", homeId: 497, away: "Lazio", awayId: 487, hoursFromNow: 30, status: "OPEN", homeStrength: 7.8, awayStrength: 7.6 },
  { ext: "fx-401", league: "Bundesliga", leagueId: 78, country: "Germany", countryCode: "GER", home: "Bayern Munich", homeId: 157, away: "Borussia Dortmund", awayId: 165, hoursFromNow: 3, status: "OPEN", homeStrength: 9.3, awayStrength: 8.4, featured: true },
  { ext: "fx-402", league: "Bundesliga", leagueId: 78, country: "Germany", countryCode: "GER", home: "RB Leipzig", homeId: 173, away: "Bayer Leverkusen", awayId: 168, hoursFromNow: 26, status: "OPEN", homeStrength: 8.2, awayStrength: 8.8 },
  { ext: "fx-501", league: "Ligue 1", leagueId: 61, country: "France", countryCode: "FRA", home: "Paris Saint-Germain", homeId: 85, away: "Marseille", awayId: 81, hoursFromNow: 7, status: "OPEN", homeStrength: 9.2, awayStrength: 7.6, featured: true },
  { ext: "fx-502", league: "Ligue 1", leagueId: 61, country: "France", countryCode: "FRA", home: "Monaco", homeId: 91, away: "Lille", awayId: 79, hoursFromNow: 29, status: "OPEN", homeStrength: 7.8, awayStrength: 7.6 },
  { ext: "fx-601", league: "UEFA Champions League", leagueId: 2, country: "Europe", countryCode: "EUR", home: "Manchester City", homeId: 50, away: "Real Madrid", awayId: 541, hoursFromNow: 48, status: "OPEN", homeStrength: 9.2, awayStrength: 9.4, featured: true },
  { ext: "fx-602", league: "UEFA Champions League", leagueId: 2, country: "Europe", countryCode: "EUR", home: "Bayern Munich", homeId: 157, away: "PSG", awayId: 85, hoursFromNow: 49, status: "OPEN", homeStrength: 9.3, awayStrength: 9.2 },
  { ext: "fx-603", league: "UEFA Champions League", leagueId: 2, country: "Europe", countryCode: "EUR", home: "Inter", homeId: 505, away: "Arsenal", awayId: 42, hoursFromNow: 72, status: "OPEN", homeStrength: 8.8, awayStrength: 8.5 },
  { ext: "fx-701", league: "AFCON", leagueId: 6, country: "Africa", countryCode: "AFR", home: "Nigeria", homeId: 1, away: "Senegal", awayId: 2, hoursFromNow: 10, status: "OPEN", homeStrength: 8.2, awayStrength: 8.4 },
  { ext: "fx-702", league: "AFCON", leagueId: 6, country: "Africa", countryCode: "AFR", home: "Morocco", homeId: 3, away: "Egypt", awayId: 4, hoursFromNow: 11, status: "OPEN", homeStrength: 8.4, awayStrength: 8.2 },
  { ext: "fx-801", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Brighton", homeId: 51, away: "West Ham", awayId: 48, hoursFromNow: -2, status: "SETTLED", homeScore: 2, awayScore: 1, homeStrength: 7.2, awayStrength: 7.4 },
  { ext: "fx-802", league: "La Liga", leagueId: 140, country: "Spain", countryCode: "ESP", home: "Real Betis", homeId: 543, away: "Valencia", awayId: 532, hoursFromNow: -3, status: "SETTLED", homeScore: 1, awayScore: 1, homeStrength: 7.0, awayStrength: 7.0 },
  { ext: "fx-901", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Everton", homeId: 45, away: "Crystal Palace", awayId: 52, hoursFromNow: 0, status: "LIVE", liveMinute: 12, homeScore: 0, awayScore: 0, homeStrength: 6.8, awayStrength: 6.6 },
  { ext: "fx-902", league: "Bundesliga", leagueId: 78, country: "Germany", countryCode: "GER", home: "Eintracht Frankfurt", homeId: 169, away: "Wolfsburg", awayId: 161, hoursFromNow: 0, status: "LIVE", liveMinute: 78, homeScore: 2, awayScore: 1, homeStrength: 7.4, awayStrength: 6.8 },
  { ext: "fx-903", league: "Ligue 1", leagueId: 61, country: "France", countryCode: "FRA", home: "Lyon", homeId: 80, away: "Nice", awayId: 84, hoursFromNow: 0, status: "LIVE", liveMinute: 45, homeScore: 1, awayScore: 1, homeStrength: 7.4, awayStrength: 7.2 },
  { ext: "fx-904", league: "Premier League", leagueId: 39, country: "England", countryCode: "ENG", home: "Wolves", homeId: 39, away: "Brentford", awayId: 55, hoursFromNow: 50, status: "OPEN", homeStrength: 6.8, awayStrength: 6.8 },
];

function logoFor(team: string): string {
  // Stable hash → media-style URL
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) >>> 0;
  return `https://media-4.api-sports.io/football/teams/${h % 999 + 1}.png`;
}

function leagueLogoFor(leagueId: number): string {
  return `https://media-4.api-sports.io/football/leagues/${leagueId}.png`;
}

function computeOdds(home: number, away: number, isLive = false): OddsBundle[] {
  // Strength-based bookmaker odds with 5% margin, optionally noised for live.
  const noise = isLive ? 0.05 : 0;
  const homeBase = home * (1 + (Math.random() - 0.5) * noise);
  const awayBase = away * (1 + (Math.random() - 0.5) * noise);
  const total = homeBase + awayBase + 6;
  const pHome = homeBase / total;
  const pAway = awayBase / total;
  const pDraw = 1 - pHome - pAway;
  const margin = 1.05;
  const home1x2 = Math.max(1.05, (1 / pHome) / margin);
  const draw1x2 = Math.max(1.05, (1 / pDraw) / margin);
  const away1x2 = Math.max(1.05, (1 / pAway) / margin);
  const goalsMu = 2.5 + (home + away) / 20;
  const over25 = goalsMu > 2.5 ? 1.4 + (3 - goalsMu) * 0.3 : 2.0 + (2.5 - goalsMu) * 0.4;
  const under25 = 1.0 / (1 - 1 / over25) || 1.9;
  const round = (n: number) => Math.max(1050, Math.min(50000, Math.round(n * 1000)));
  return [
    {
      marketType: "1X2",
      selections: [
        { outcome: 0, label: "Home Win", valueX1000: round(home1x2) },
        { outcome: 1, label: "Draw", valueX1000: round(draw1x2) },
        { outcome: 2, label: "Away Win", valueX1000: round(away1x2) },
      ],
    },
    {
      marketType: "over_under_15",
      selections: [
        { outcome: 0, label: "Over 1.5", valueX1000: round(1.25 + (2.5 - goalsMu) * 0.1) },
        { outcome: 1, label: "Under 1.5", valueX1000: round(3.6 + (goalsMu - 2.5) * 0.5) },
      ],
    },
    {
      marketType: "over_under_25",
      selections: [
        { outcome: 0, label: "Over 2.5", valueX1000: round(over25) },
        { outcome: 1, label: "Under 2.5", valueX1000: round(under25) },
      ],
    },
    {
      marketType: "over_under_35",
      selections: [
        { outcome: 0, label: "Over 3.5", valueX1000: round(2.7 + (2.5 - goalsMu) * 0.3) },
        { outcome: 1, label: "Under 3.5", valueX1000: round(1.45 + (goalsMu - 2.5) * 0.2) },
      ],
    },
    {
      marketType: "btts",
      selections: [
        { outcome: 0, label: "BTTS Yes", valueX1000: round(1.65 + (4 - (home + away) / 2) * 0.05) },
        { outcome: 1, label: "BTTS No", valueX1000: round(2.15 + ((home + away) / 2 - 4) * 0.05) },
      ],
    },
    {
      marketType: "double_chance",
      selections: [
        { outcome: 0, label: "1X", valueX1000: round(Math.max(1.05, 1 / (pHome + pDraw) / 1.04)) },
        { outcome: 1, label: "12", valueX1000: round(Math.max(1.05, 1 / (pHome + pAway) / 1.04)) },
        { outcome: 2, label: "X2", valueX1000: round(Math.max(1.05, 1 / (pDraw + pAway) / 1.04)) },
      ],
    },
    {
      marketType: "asian_handicap",
      selections: [
        { outcome: 0, label: "Home -0.5", valueX1000: round(home1x2 * 0.95) },
        { outcome: 1, label: "Away +0.5", valueX1000: round(away1x2 * 1.05) },
      ],
    },
  ];
}

function buildMarket(s: Seed): MarketDTO {
  const id = `mkt-${s.ext}`;
  const startTime = new Date(Date.now() + s.hoursFromNow * 3600 * 1000).toISOString();
  const isLive = s.status === "LIVE";
  const odds = computeOdds(s.homeStrength, s.awayStrength, isLive);
  return {
    id,
    externalId: s.ext,
    fixtureId: Math.abs(s.leagueId * 10000 + s.homeId) % 9_999_999,
    leagueId: s.leagueId,
    leagueName: s.league,
    leagueLogo: leagueLogoFor(s.leagueId),
    country: s.country,
    countryCode: s.countryCode,
    homeTeam: s.home,
    homeTeamId: s.homeId,
    homeTeamLogo: logoFor(s.home),
    awayTeam: s.away,
    awayTeamId: s.awayId,
    awayTeamLogo: logoFor(s.away),
    startTime,
    status: s.status,
    liveMinute: s.liveMinute,
    homeScore: s.homeScore,
    awayScore: s.awayScore,
    winningOutcome: s.status === "SETTLED" ? ((s.homeScore ?? 0) > (s.awayScore ?? 0) ? 0 : (s.homeScore ?? 0) === (s.awayScore ?? 0) ? 1 : 2) : undefined,
    poolAddress: randAddr(),
    poolTvl: toUsdc(BigInt(Math.floor(2000 + Math.random() * 8000)) * USDC_SCALE),
    poolLocked: toUsdc(BigInt(Math.floor(200 + Math.random() * 1500)) * USDC_SCALE),
    poolBetVolume: toUsdc(BigInt(Math.floor(500 + Math.random() * 5000)) * USDC_SCALE),
    isFeatured: !!s.featured,
    odds,
    marketsCount: 240 + Math.floor(Math.random() * 80),
    events: isLive
      ? [
          { minute: 0, type: "kick_off" },
          ...(s.homeScore && s.homeScore > 0 ? [{ minute: 23, type: "goal" as const, team: "home" as const, player: "Player A" }] : []),
          ...(s.awayScore && s.awayScore > 0 ? [{ minute: 41, type: "goal" as const, team: "away" as const, player: "Player B" }] : []),
        ]
      : undefined,
  };
}

// --- state init -----------------------------------------------------------

function getState(): StoreState {
  if (globalThis.__ss_store__) return globalThis.__ss_store__;

  const state: StoreState = {
    users: [],
    markets: [],
    bets: [],
    parlays: [],
    lpPositions: [],
    casinoGames: [
      { id: "g-crash", slug: "crash", name: "Crash", category: "Crash", houseEdgeBps: 100, minBet: "1.00", maxBet: "5000.00", description: "Bet, ride the multiplier, cash out before it crashes." },
      { id: "g-dice", slug: "dice", name: "Dice", category: "Dice", houseEdgeBps: 100, minBet: "1.00", maxBet: "10000.00", description: "Roll over or under your chosen number." },
      { id: "g-slots", slug: "slots", name: "Slots", category: "Slots", houseEdgeBps: 350, minBet: "0.10", maxBet: "500.00", description: "Classic 5×3 slot machine with 20 paylines." },
      { id: "g-blackjack", slug: "blackjack", name: "Blackjack", category: "Table", houseEdgeBps: 50, minBet: "1.00", maxBet: "5000.00", description: "Beat the dealer to 21 — provably fair shuffle." },
      { id: "g-roulette", slug: "roulette", name: "Roulette", category: "Table", houseEdgeBps: 270, minBet: "1.00", maxBet: "5000.00", description: "European wheel. Inside, outside, columns, dozens." },
      { id: "g-baccarat", slug: "baccarat", name: "Baccarat", category: "Table", houseEdgeBps: 120, minBet: "1.00", maxBet: "5000.00", description: "Player or Banker — whoever gets closest to 9." },
    ],
    diceHistory: [],
    slotsHistory: [],
    feed: [],
    currentCrash: {
      id: 1,
      status: "waiting",
      multiplierX100: 100,
      players: [],
      history: [],
    },
    crashHistory: [],
    follows: [],
    notifications: [],
    auditLog: [],
    nonces: new Map(),
    refreshTokens: new Map(),
    predictionCache: new Map(),
    quota: {
      used: 14,
      remaining: 86,
      resetAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
      mode: "normal",
    },
    rateLimits: new Map(),
    poolBetsTracker: new Map(),
    bootstrapped: false,
  };

  // Seed users (1 admin, 4 regular)
  state.users.push({
    id: "user-admin",
    walletAddress: "0xAd111111111111111111111111111111111111aD" as Address,
    username: "house",
    referralCode: referralCode(),
    isPublic: false,
    isBanned: false,
    roles: ["USER", "ADMIN", "OPERATOR"],
    createdAt: new Date(Date.now() - 90 * 86400_000).toISOString(),
  });
  for (let i = 0; i < 4; i++) {
    state.users.push({
      id: `user-${i + 1}`,
      walletAddress: randAddr(),
      username: ["luckyPunter", "valueHunter", "whaleAlpha", "parlayKing"][i],
      referralCode: referralCode(),
      isPublic: true,
      isBanned: false,
      roles: ["USER"],
      createdAt: new Date(Date.now() - (30 + i * 7) * 86400_000).toISOString(),
    });
  }

  // Seed markets
  state.markets = SEEDS.map(buildMarket);

  // Seed LP positions for a few markets and users
  for (let i = 0; i < 3; i++) {
    const mkt = state.markets[i + 1];
    const user = state.users[i + 1];
    const deposit = BigInt(250 + Math.floor(Math.random() * 1500)) * USDC_SCALE;
    state.lpPositions.push({
      id: `lp-${shortId()}`,
      userId: user.id,
      userAddress: user.walletAddress,
      marketId: mkt.id,
      marketLabel: `${mkt.homeTeam} vs ${mkt.awayTeam}`,
      onchainShares: deposit.toString(),
      depositedUsdc: toUsdc(deposit),
      currentValueUsdc: toUsdc(deposit + BigInt(Math.floor(Math.random() * 30)) * USDC_SCALE),
      status: "ACTIVE",
      txHash: `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`,
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    });
  }

  // Seed some past bets
  for (let i = 0; i < 12; i++) {
    const user = state.users[1 + (i % 4)];
    const mkt = state.markets[i % state.markets.length];
    const odds = mkt.odds[0].selections;
    const sel = odds[i % odds.length];
    const amount = BigInt(10 + Math.floor(Math.random() * 200)) * USDC_SCALE;
    const payout = (amount * BigInt(sel.valueX1000)) / 1000n;
    const settled = mkt.status === "SETTLED" || Math.random() > 0.7;
    const won = settled && Math.random() > 0.55;
    const cancelled = settled && Math.random() > 0.92;
    const status: BetStatus = cancelled ? "CANCELLED" : settled ? (won ? "WON" : "LOST") : "PENDING";
    state.bets.push({
      id: `bet-${shortId()}`,
      userId: user.id,
      userAddress: user.walletAddress,
      marketId: mkt.id,
      marketLabel: `${mkt.homeTeam} vs ${mkt.awayTeam}`,
      marketType: "1X2",
      outcome: sel.outcome,
      selectionLabel: sel.label,
      amount: toUsdc(amount),
      oddsX1000: sel.valueX1000,
      potentialPayout: toUsdc(payout),
      status,
      isLive: mkt.status === "LIVE",
      isPublic: true,
      txHash: `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400_000)).toISOString(),
      settledAt: settled ? new Date(Date.now() - Math.floor(Math.random() * 86400_000)).toISOString() : undefined,
    });
  }

  // Seed feed
  for (let i = 0; i < 10; i++) {
    const u = state.users[1 + (i % 4)];
    state.feed.push({
      id: `feed-${shortId()}`,
      type: i % 3 === 0 ? "big_win" : "bet",
      userAddress: u.walletAddress,
      username: u.username,
      amount: toUsdc(BigInt(50 + Math.floor(Math.random() * 2000)) * USDC_SCALE),
      detail: i % 3 === 0 ? "won on PSG to win @ 1.85" : "placed bet on Real Madrid @ 2.10",
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
      likes: Math.floor(Math.random() * 24),
    });
  }

  globalThis.__ss_store__ = state;

  // Start simulators after returning the state object.
  setImmediate(() => startSimulators());

  return state;
}

function startSimulators(): void {
  const state = getState();
  if (state.bootstrapped) return;
  state.bootstrapped = true;

  // Live odds drift every 4s
  setInterval(() => {
    for (const mkt of state.markets) {
      if (mkt.status !== "LIVE" && mkt.status !== "OPEN") continue;
      for (const bundle of mkt.odds) {
        for (const sel of bundle.selections) {
          const prev = sel.valueX1000;
          const delta = Math.round((Math.random() - 0.5) * 10);
          const next = Math.max(1050, Math.min(50000, prev + delta));
          sel.prevValueX1000 = prev;
          sel.valueX1000 = next;
          sel.movement = next > prev ? "up" : next < prev ? "down" : "same";
        }
      }
    }
    // Broadcast a few live ones each tick to avoid noise
    const live = state.markets.filter((m) => m.status === "LIVE").slice(0, 3);
    for (const m of live) publish("odds:update", { marketId: m.id, odds: m.odds });
  }, 4000);

  // Live minute ticker every 6s
  setInterval(() => {
    for (const mkt of state.markets) {
      if (mkt.status !== "LIVE") continue;
      const minute = (mkt.liveMinute ?? 0) + 1;
      mkt.liveMinute = minute;
      if (Math.random() < 0.04) {
        // Goal
        const team: "home" | "away" = Math.random() < 0.5 ? "home" : "away";
        if (team === "home") mkt.homeScore = (mkt.homeScore ?? 0) + 1;
        else mkt.awayScore = (mkt.awayScore ?? 0) + 1;
        mkt.events = [...(mkt.events ?? []), { minute, type: "goal", team, player: "Striker" }];
      }
      if (minute >= 90 + Math.floor(Math.random() * 6)) {
        mkt.status = "SETTLED";
        const hs = mkt.homeScore ?? 0;
        const as = mkt.awayScore ?? 0;
        mkt.winningOutcome = hs > as ? 0 : hs === as ? 1 : 2;
        settleMarketBets(mkt.id, mkt.winningOutcome);
        publish("market:finished", { marketId: mkt.id, homeScore: hs, awayScore: as });
      } else {
        publish("market:live", { marketId: mkt.id, minute, homeScore: mkt.homeScore, awayScore: mkt.awayScore });
      }
    }
  }, 6000);

  // Periodic feed event
  setInterval(() => {
    const u = state.users[1 + Math.floor(Math.random() * 4)];
    const item: FeedItem = {
      id: `feed-${shortId()}`,
      type: Math.random() < 0.3 ? "big_win" : "bet",
      userAddress: u.walletAddress,
      username: u.username,
      amount: toUsdc(BigInt(20 + Math.floor(Math.random() * 1800)) * USDC_SCALE),
      detail: "live wager placed",
      createdAt: nowIso(),
      likes: 0,
    };
    state.feed.unshift(item);
    state.feed = state.feed.slice(0, 200);
    publish("feed:new", item);
  }, 12000);

  // Crash round engine
  setInterval(() => stepCrashRound(), 250);

  // Quota gentle drift (simulated)
  setInterval(() => {
    if (state.quota.remaining > 5) {
      state.quota.remaining -= 1;
      state.quota.used += 1;
      state.quota.mode = state.quota.remaining < 5 ? "emergency" : state.quota.remaining < 15 ? "conservation" : "normal";
      publish("quota:alert", state.quota);
    }
  }, 60_000);
}

// --- bet settlement -------------------------------------------------------

function settleMarketBets(marketId: string, winningOutcome: number): void {
  const state = getState();
  for (const b of state.bets) {
    if (b.marketId !== marketId || b.status !== "PENDING") continue;
    if (b.marketType === "1X2") {
      b.status = b.outcome === winningOutcome ? "WON" : "LOST";
    } else {
      b.status = Math.random() < 0.5 ? "WON" : "LOST";
    }
    b.settledAt = nowIso();
    publish("bet:settled", { betId: b.id, status: b.status });
  }
  // LP positions: settle them
  for (const lp of state.lpPositions) {
    if (lp.marketId !== marketId || lp.status === "SETTLED") continue;
    const deposit = fromUsdc(lp.depositedUsdc);
    const drift = BigInt(Math.floor((Math.random() - 0.45) * 60)) * (USDC_SCALE / 100n);
    const final = deposit + drift;
    lp.status = "SETTLED";
    lp.settledAt = nowIso();
    lp.finalUsdc = toUsdc(final);
    lp.pnl = toUsdc(final - deposit);
    publish("lp:settled", { marketId, lpId: lp.id, pnl: lp.pnl });
  }
}

// --- crash engine ---------------------------------------------------------

function stepCrashRound(): void {
  const state = getState();
  const r = state.currentCrash;
  const now = Date.now();
  if (r.status === "waiting") {
    if (!r.startedAt) r.startedAt = nowIso();
    const waited = now - new Date(r.startedAt).getTime();
    if (waited >= 5000) {
      r.status = "running";
      r.startedAt = nowIso();
      r.multiplierX100 = 100;
      publish("crash:state", r);
    }
  } else if (r.status === "running") {
    const elapsed = (now - new Date(r.startedAt!).getTime()) / 1000;
    // exponential growth
    const m = Math.exp(elapsed * 0.07);
    r.multiplierX100 = Math.round(m * 100);
    // crash point: provably-fair-like hash from id
    const crashAt = 1 + (((r.id * 9301 + 49297) % 233280) / 233280) * 20;
    if (m >= crashAt) {
      r.status = "crashed";
      r.crashMultiplierX100 = Math.round(crashAt * 100);
      // resolve players
      for (const p of r.players) {
        const cashOut = p.cashedOutAtX100 ?? p.autoCashoutX100 ?? 0;
        const valid = cashOut > 0 && cashOut <= r.crashMultiplierX100;
        if (valid) {
          const amt = fromUsdc(p.amount);
          const payout = (amt * BigInt(cashOut)) / 100n;
          p.profit = toUsdc(payout - amt);
        } else {
          p.profit = toUsdc(-fromUsdc(p.amount));
        }
      }
      publish("crash:state", r);
      state.crashHistory.unshift({ ...r });
      state.crashHistory = state.crashHistory.slice(0, 50);
      // schedule next
      setTimeout(() => {
        const nextId = r.id + 1;
        const history = [r.crashMultiplierX100!, ...(r.history || [])].slice(0, 20);
        state.currentCrash = {
          id: nextId,
          status: "waiting",
          multiplierX100: 100,
          players: [],
          history,
          startedAt: nowIso(),
        };
        publish("crash:state", state.currentCrash);
      }, 3000);
    } else if (r.multiplierX100 % 25 === 0) {
      publish("crash:state", r);
    }
  }
}

// --- public API -----------------------------------------------------------

export function store() {
  return getState();
}

export const utils = {
  fromUsdc,
  toUsdc,
  fmtUsdcShort,
  randAddr,
  nowIso,
  USDC_SCALE,
};

// Compute pool stats for a market.
export function getPoolStats(marketId: string): PoolStats | null {
  const s = getState();
  const m = s.markets.find((x) => x.id === marketId);
  if (!m) return null;
  const tvl = fromUsdc(m.poolTvl);
  const locked = fromUsdc(m.poolLocked);
  const volume = fromUsdc(m.poolBetVolume);
  const utilization = tvl === 0n ? 0 : Number((locked * 10000n) / tvl) / 10000;
  const lpCount = s.lpPositions.filter((p) => p.marketId === marketId).length || 1 + (m.fixtureId % 8);
  const exposureByOutcome = m.odds[0]?.selections.map((sel) => ({
    outcome: sel.outcome,
    label: sel.label,
    risk: toUsdc((locked * BigInt(Math.round(sel.valueX1000))) / BigInt(m.odds[0].selections.reduce((a, b) => a + b.valueX1000, 0))),
  })) ?? [];
  const apy = 100 * (0.02 * (Number(volume / USDC_SCALE) / Math.max(1, Number(tvl / USDC_SCALE)))) * 365;
  const health: PoolStats["health"] =
    new Date(m.startTime).getTime() - Date.now() < 30 * 60_000 ? "locked"
    : utilization > 0.8 ? "full"
    : utilization > 0.5 ? "filling"
    : "safe";
  return {
    marketId,
    poolAddress: m.poolAddress,
    tvl: m.poolTvl,
    totalShares: m.poolTvl,
    locked: m.poolLocked,
    utilization,
    betVolume: m.poolBetVolume,
    lpCount,
    exposureByOutcome,
    estimatedApy: Math.min(45, Math.max(2, apy)),
    health,
    closesAt: m.startTime,
  };
}

export function computeUserStats(userId: string): UserStats {
  const s = getState();
  const bets = s.bets.filter((b) => b.userId === userId);
  let won = 0, lost = 0, wagered = 0n, payout = 0n;
  let streak = 0, bestStreak = 0, currentStreak = 0;
  for (const b of bets.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    wagered += fromUsdc(b.amount);
    if (b.status === "WON") { won++; payout += fromUsdc(b.potentialPayout); currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1; }
    else if (b.status === "LOST") { lost++; currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1; }
    bestStreak = Math.max(bestStreak, currentStreak);
    streak = currentStreak;
  }
  const totalBets = bets.length;
  const winRate = totalBets > 0 ? won / Math.max(1, won + lost) : 0;
  const netPnl = payout - wagered;
  const badges: UserStats["badges"] = [];
  if (streak >= 3) badges.push("HOT_STREAK");
  if (wagered > 5000n * USDC_SCALE) badges.push("HIGH_ROLLER");
  if (wagered > 50000n * USDC_SCALE) badges.push("WHALE");
  if (winRate > 0.6) badges.push("VALUE_BETTOR");
  return {
    totalBets, won, lost,
    winRate: Math.round(winRate * 1000) / 1000,
    totalWagered: toUsdc(wagered),
    totalPayout: toUsdc(payout),
    netPnl: toUsdc(netPnl),
    currentStreak: streak,
    bestStreak,
    badges,
  };
}

export function computeLeaderboard(period: "weekly" | "monthly" | "alltime"): LeaderboardEntry[] {
  const s = getState();
  const cutoff = period === "weekly" ? Date.now() - 7 * 86400_000
               : period === "monthly" ? Date.now() - 30 * 86400_000
               : 0;
  const byUser = new Map<string, { user: UserDTO; bets: number; won: number; lost: number; vol: bigint; pnl: bigint; streak: number }>();
  for (const u of s.users) {
    byUser.set(u.id, { user: u, bets: 0, won: 0, lost: 0, vol: 0n, pnl: 0n, streak: 0 });
  }
  for (const b of s.bets) {
    if (new Date(b.createdAt).getTime() < cutoff) continue;
    const entry = byUser.get(b.userId);
    if (!entry) continue;
    entry.bets++;
    entry.vol += fromUsdc(b.amount);
    if (b.status === "WON") { entry.won++; entry.pnl += fromUsdc(b.potentialPayout) - fromUsdc(b.amount); }
    else if (b.status === "LOST") { entry.lost++; entry.pnl -= fromUsdc(b.amount); }
  }
  return Array.from(byUser.values())
    .filter((e) => e.bets > 0)
    .sort((a, b) => (b.pnl > a.pnl ? 1 : -1))
    .slice(0, 50)
    .map((e, i) => ({
      rank: i + 1,
      userId: e.user.id,
      walletAddress: e.user.walletAddress,
      username: e.user.username,
      bets: e.bets,
      winRate: e.bets > 0 ? Math.round((e.won / Math.max(1, e.won + e.lost)) * 1000) / 1000 : 0,
      volume: toUsdc(e.vol),
      pnl: toUsdc(e.pnl),
      streak: e.streak,
    }));
}
