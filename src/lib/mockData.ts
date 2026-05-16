export type Match = {
  id: string;
  sport: string;
  league: string;
  leagueIcon: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number | null;
  awayOdds: number;
  time: string;
  isLive: boolean;
  liveMinute?: number;
  homeScore?: number;
  awayScore?: number;
  totalOverOdds?: number;
  totalUnderOdds?: number;
  totalLine?: number;
};

export type CasinoGame = {
  id: string;
  name: string;
  category: string;
  provider: string;
  rtp: number;
  minBet: number;
  maxBet: number;
  color: string;
  icon: string;
};

export type LiquidityPool = {
  id: string;
  name: string;
  asset: string;
  tvl: number;
  apy: number;
  volume24h: number;
  myStake: number;
  myEarnings: number;
};

export type EsportsMatch = {
  id: string;
  game: string;
  gameIcon: string;
  tournament: string;
  team1: string;
  team2: string;
  team1Odds: number;
  team2Odds: number;
  time: string;
  isLive: boolean;
};

export const matches: Match[] = [
  {
    id: "m1",
    sport: "Football",
    league: "Premier League",
    leagueIcon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    homeTeam: "Arsenal",
    awayTeam: "Manchester City",
    homeOdds: 2.85,
    drawOdds: 3.40,
    awayOdds: 2.20,
    time: "Today, 20:45",
    isLive: false,
    totalOverOdds: 1.87,
    totalUnderOdds: 1.95,
    totalLine: 2.5,
  },
  {
    id: "m2",
    sport: "Football",
    league: "Premier League",
    leagueIcon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    homeTeam: "Chelsea",
    awayTeam: "Liverpool",
    homeOdds: 2.60,
    drawOdds: 3.20,
    awayOdds: 2.55,
    time: "67'",
    isLive: true,
    liveMinute: 67,
    homeScore: 1,
    awayScore: 1,
    totalOverOdds: 1.75,
    totalUnderOdds: 2.05,
    totalLine: 2.5,
  },
  {
    id: "m3",
    sport: "Football",
    league: "La Liga",
    leagueIcon: "🇪🇸",
    homeTeam: "Real Madrid",
    awayTeam: "FC Barcelona",
    homeOdds: 2.10,
    drawOdds: 3.50,
    awayOdds: 3.20,
    time: "Tomorrow, 21:00",
    isLive: false,
    totalOverOdds: 1.80,
    totalUnderOdds: 2.00,
    totalLine: 2.5,
  },
  {
    id: "m4",
    sport: "Football",
    league: "Bundesliga",
    leagueIcon: "🇩🇪",
    homeTeam: "Bayern Munich",
    awayTeam: "Borussia Dortmund",
    homeOdds: 1.65,
    drawOdds: 3.80,
    awayOdds: 5.00,
    time: "23'",
    isLive: true,
    liveMinute: 23,
    homeScore: 0,
    awayScore: 0,
    totalOverOdds: 1.70,
    totalUnderOdds: 2.10,
    totalLine: 3.5,
  },
  {
    id: "m5",
    sport: "Basketball",
    league: "NBA",
    leagueIcon: "🏀",
    homeTeam: "LA Lakers",
    awayTeam: "Boston Celtics",
    homeOdds: 2.05,
    drawOdds: null,
    awayOdds: 1.78,
    time: "Today, 01:30",
    isLive: false,
    totalOverOdds: 1.90,
    totalUnderOdds: 1.90,
    totalLine: 221.5,
  },
  {
    id: "m6",
    sport: "Basketball",
    league: "NBA",
    leagueIcon: "🏀",
    homeTeam: "Golden State Warriors",
    awayTeam: "Miami Heat",
    homeOdds: 1.55,
    drawOdds: null,
    awayOdds: 2.45,
    time: "Q3 5:22",
    isLive: true,
    liveMinute: undefined,
    homeScore: 78,
    awayScore: 72,
    totalOverOdds: 1.88,
    totalUnderOdds: 1.92,
    totalLine: 218.5,
  },
  {
    id: "m7",
    sport: "Tennis",
    league: "ATP - Roland Garros",
    leagueIcon: "🎾",
    homeTeam: "C. Alcaraz",
    awayTeam: "N. Djokovic",
    homeOdds: 1.90,
    drawOdds: null,
    awayOdds: 1.95,
    time: "Today, 14:00",
    isLive: false,
  },
  {
    id: "m8",
    sport: "Football",
    league: "Serie A",
    leagueIcon: "🇮🇹",
    homeTeam: "Inter Milan",
    awayTeam: "AC Milan",
    homeOdds: 2.30,
    drawOdds: 3.10,
    awayOdds: 3.00,
    time: "Tomorrow, 18:00",
    isLive: false,
    totalOverOdds: 1.85,
    totalUnderOdds: 1.95,
    totalLine: 2.5,
  },
];

export const casinoGames: CasinoGame[] = [
  { id: "cg1", name: "Book of Dead", category: "Slots", provider: "Play'n GO", rtp: 96.21, minBet: 0.10, maxBet: 100, color: "#c9920a", icon: "📖" },
  { id: "cg2", name: "Blackjack Pro", category: "Table", provider: "SportyStake", rtp: 99.50, minBet: 1, maxBet: 10000, color: "#1e5c2d", icon: "🃏" },
  { id: "cg3", name: "Mega Roulette", category: "Table", provider: "Pragmatic", rtp: 97.30, minBet: 0.50, maxBet: 5000, color: "#b91c1c", icon: "🎡" },
  { id: "cg4", name: "Crash Rocket", category: "Crash", provider: "SportyStake", rtp: 97.00, minBet: 0.10, maxBet: 500, color: "#7c3aed", icon: "🚀" },
  { id: "cg5", name: "Sweet Bonanza", category: "Slots", provider: "Pragmatic", rtp: 96.51, minBet: 0.20, maxBet: 125, color: "#db2777", icon: "🍭" },
  { id: "cg6", name: "Dice Duel", category: "Dice", provider: "SportyStake", rtp: 99.00, minBet: 0.10, maxBet: 1000, color: "#0891b2", icon: "🎲" },
  { id: "cg7", name: "Baccarat Live", category: "Live", provider: "Evolution", rtp: 98.76, minBet: 5, maxBet: 25000, color: "#064e3b", icon: "🎴" },
  { id: "cg8", name: "Gates of Olympus", category: "Slots", provider: "Pragmatic", rtp: 96.50, minBet: 0.20, maxBet: 125, color: "#1e40af", icon: "⚡" },
];

export const liquidityPools: LiquidityPool[] = [
  { id: "lp1", name: "Sportsbook Main Pool", asset: "USDT", tvl: 4_250_000, apy: 12.4, volume24h: 890_000, myStake: 5000, myEarnings: 62.3 },
  { id: "lp2", name: "Casino Reserve Pool", asset: "USDC", tvl: 2_180_000, apy: 9.8, volume24h: 430_000, myStake: 0, myEarnings: 0 },
  { id: "lp3", name: "High Yield Pool", asset: "ETH", tvl: 1_640_000, apy: 18.2, volume24h: 210_000, myStake: 0, myEarnings: 0 },
  { id: "lp4", name: "Stable Yield Pool", asset: "USDT", tvl: 870_000, apy: 7.5, volume24h: 95_000, myStake: 0, myEarnings: 0 },
];

export const esportsMatches: EsportsMatch[] = [
  { id: "es1", game: "CS2", gameIcon: "🎯", tournament: "ESL Pro League S21", team1: "Natus Vincere", team2: "FaZe Clan", team1Odds: 2.10, team2Odds: 1.72, time: "Today, 18:00", isLive: false },
  { id: "es2", game: "Valorant", gameIcon: "⚡", tournament: "VCT Masters", team1: "Sentinels", team2: "Team Liquid", team1Odds: 1.85, team2Odds: 1.95, time: "LIVE", isLive: true },
  { id: "es3", game: "Dota 2", gameIcon: "🗡️", tournament: "DreamLeague S23", team1: "Team Spirit", team2: "OG", team1Odds: 1.60, team2Odds: 2.25, time: "Today, 21:00", isLive: false },
  { id: "es4", game: "LoL", gameIcon: "🏆", tournament: "LEC Summer Split", team1: "G2 Esports", team2: "Fnatic", team1Odds: 1.45, team2Odds: 2.70, time: "Tomorrow, 17:00", isLive: false },
];

export const stats = {
  totalVolume: "124.8M",
  activePlayers: "48,204",
  poolsLiquidity: "8.94M",
  sportsMarkets: "12,400+",
};
