import type { SportSlug } from "@/components/icons/SportIcons";

export type Match = {
  id: string;
  sport: string;
  sportSlug: SportSlug;
  league: string;
  leagueShort: string;
  country: string;          // ISO country (for tinted chip)
  homeTeam: string;
  awayTeam: string;
  homeShort: string;        // 3-letter short
  awayShort: string;
  homeColor: string;        // tw-style hex for badge ring
  awayColor: string;
  homeOdds: number;
  drawOdds: number | null;
  awayOdds: number;
  startsAt: string;         // ISO datetime or "live"
  time: string;             // human readable
  isLive: boolean;
  liveMinute?: string;
  homeScore?: number;
  awayScore?: number;
  totalOverOdds?: number;
  totalUnderOdds?: number;
  totalLine?: number;
  markets: number;          // count of additional markets
  isHot?: boolean;
};

export type CasinoGame = {
  id: string;
  name: string;
  category: "Slots" | "Table" | "Live" | "Crash" | "Dice" | "Original";
  provider: string;
  rtp: number;
  minBet: number;
  maxBet: number;
  color: string;
  accent: string;
  tag?: "HOT" | "NEW" | "JACKPOT";
  players?: number;
};

export type LiquidityPool = {
  id: string;
  name: string;
  asset: "USDT" | "USDC" | "ETH";
  tvl: number;
  apy: number;
  volume24h: number;
  myStake: number;
  myEarnings: number;
  utilization: number; // 0-1
};

export type EsportsMatch = {
  id: string;
  game: string;
  gameSlug: string;
  tournament: string;
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  team1Color: string;
  team2Color: string;
  team1Odds: number;
  team2Odds: number;
  time: string;
  isLive: boolean;
};

export const matches: Match[] = [
  {
    id: "m1", sport: "Soccer", sportSlug: "soccer",
    league: "Premier League", leagueShort: "EPL", country: "ENG",
    homeTeam: "Arsenal", awayTeam: "Manchester City",
    homeShort: "ARS", awayShort: "MCI",
    homeColor: "#EF0107", awayColor: "#6CABDD",
    homeOdds: 2.85, drawOdds: 3.40, awayOdds: 2.20,
    startsAt: "2026-05-16T20:45:00Z", time: "Today · 20:45",
    isLive: false, totalOverOdds: 1.87, totalUnderOdds: 1.95, totalLine: 2.5,
    markets: 248, isHot: true,
  },
  {
    id: "m2", sport: "Soccer", sportSlug: "soccer",
    league: "Premier League", leagueShort: "EPL", country: "ENG",
    homeTeam: "Chelsea", awayTeam: "Liverpool",
    homeShort: "CHE", awayShort: "LIV",
    homeColor: "#034694", awayColor: "#C8102E",
    homeOdds: 2.60, drawOdds: 3.20, awayOdds: 2.55,
    startsAt: "live", time: "67'",
    isLive: true, liveMinute: "67'", homeScore: 1, awayScore: 1,
    totalOverOdds: 1.75, totalUnderOdds: 2.05, totalLine: 2.5,
    markets: 312,
  },
  {
    id: "m3", sport: "Soccer", sportSlug: "soccer",
    league: "La Liga", leagueShort: "LAL", country: "ESP",
    homeTeam: "Real Madrid", awayTeam: "FC Barcelona",
    homeShort: "RMA", awayShort: "BAR",
    homeColor: "#FEBE10", awayColor: "#A50044",
    homeOdds: 2.10, drawOdds: 3.50, awayOdds: 3.20,
    startsAt: "2026-05-17T21:00:00Z", time: "Tomorrow · 21:00",
    isLive: false, totalOverOdds: 1.80, totalUnderOdds: 2.00, totalLine: 2.5,
    markets: 286, isHot: true,
  },
  {
    id: "m4", sport: "Soccer", sportSlug: "soccer",
    league: "Bundesliga", leagueShort: "BUN", country: "GER",
    homeTeam: "Bayern Munich", awayTeam: "Borussia Dortmund",
    homeShort: "BAY", awayShort: "BVB",
    homeColor: "#DC052D", awayColor: "#FDE100",
    homeOdds: 1.65, drawOdds: 3.80, awayOdds: 5.00,
    startsAt: "live", time: "23'",
    isLive: true, liveMinute: "23'", homeScore: 0, awayScore: 0,
    totalOverOdds: 1.70, totalUnderOdds: 2.10, totalLine: 3.5,
    markets: 214,
  },
  {
    id: "m5", sport: "Basketball", sportSlug: "basketball",
    league: "NBA", leagueShort: "NBA", country: "USA",
    homeTeam: "LA Lakers", awayTeam: "Boston Celtics",
    homeShort: "LAL", awayShort: "BOS",
    homeColor: "#552583", awayColor: "#007A33",
    homeOdds: 2.05, drawOdds: null, awayOdds: 1.78,
    startsAt: "2026-05-17T01:30:00Z", time: "Today · 01:30",
    isLive: false, totalOverOdds: 1.90, totalUnderOdds: 1.90, totalLine: 221.5,
    markets: 168,
  },
  {
    id: "m6", sport: "Basketball", sportSlug: "basketball",
    league: "NBA", leagueShort: "NBA", country: "USA",
    homeTeam: "Golden State Warriors", awayTeam: "Miami Heat",
    homeShort: "GSW", awayShort: "MIA",
    homeColor: "#1D428A", awayColor: "#98002E",
    homeOdds: 1.55, drawOdds: null, awayOdds: 2.45,
    startsAt: "live", time: "Q3 5:22",
    isLive: true, liveMinute: "Q3 5:22", homeScore: 78, awayScore: 72,
    totalOverOdds: 1.88, totalUnderOdds: 1.92, totalLine: 218.5,
    markets: 144,
  },
  {
    id: "m7", sport: "Tennis", sportSlug: "tennis",
    league: "ATP · Roland Garros", leagueShort: "ATP", country: "FRA",
    homeTeam: "C. Alcaraz", awayTeam: "N. Djokovic",
    homeShort: "ALC", awayShort: "DJO",
    homeColor: "#E30613", awayColor: "#1A4D2E",
    homeOdds: 1.90, drawOdds: null, awayOdds: 1.95,
    startsAt: "2026-05-16T14:00:00Z", time: "Today · 14:00",
    isLive: false, markets: 86, isHot: true,
  },
  {
    id: "m8", sport: "Soccer", sportSlug: "soccer",
    league: "Serie A", leagueShort: "SEA", country: "ITA",
    homeTeam: "Inter Milan", awayTeam: "AC Milan",
    homeShort: "INT", awayShort: "MIL",
    homeColor: "#0067B1", awayColor: "#FB090B",
    homeOdds: 2.30, drawOdds: 3.10, awayOdds: 3.00,
    startsAt: "2026-05-17T18:00:00Z", time: "Tomorrow · 18:00",
    isLive: false, totalOverOdds: 1.85, totalUnderOdds: 1.95, totalLine: 2.5,
    markets: 222,
  },
  {
    id: "m9", sport: "Soccer", sportSlug: "soccer",
    league: "UCL · Semi-Final", leagueShort: "UCL", country: "EUR",
    homeTeam: "PSG", awayTeam: "Manchester City",
    homeShort: "PSG", awayShort: "MCI",
    homeColor: "#004170", awayColor: "#6CABDD",
    homeOdds: 3.40, drawOdds: 3.50, awayOdds: 2.05,
    startsAt: "2026-05-18T20:00:00Z", time: "Wed · 20:00",
    isLive: false, totalOverOdds: 1.78, totalUnderOdds: 2.02, totalLine: 2.5,
    markets: 268, isHot: true,
  },
  {
    id: "m10", sport: "Ice Hockey", sportSlug: "hockey",
    league: "NHL", leagueShort: "NHL", country: "USA",
    homeTeam: "Edmonton Oilers", awayTeam: "Florida Panthers",
    homeShort: "EDM", awayShort: "FLA",
    homeColor: "#FF4C00", awayColor: "#C8102E",
    homeOdds: 1.95, drawOdds: 4.10, awayOdds: 2.10,
    startsAt: "live", time: "P2 11:42",
    isLive: true, liveMinute: "P2 11:42", homeScore: 2, awayScore: 3,
    markets: 102,
  },
  {
    id: "m11", sport: "Soccer", sportSlug: "soccer",
    league: "Ligue 1", leagueShort: "LI1", country: "FRA",
    homeTeam: "Marseille", awayTeam: "Lyon",
    homeShort: "OM", awayShort: "OL",
    homeColor: "#009DDC", awayColor: "#143C8C",
    homeOdds: 2.15, drawOdds: 3.30, awayOdds: 3.10,
    startsAt: "2026-05-17T19:00:00Z", time: "Tomorrow · 19:00",
    isLive: false, totalOverOdds: 1.82, totalUnderOdds: 1.98, totalLine: 2.5,
    markets: 184,
  },
  {
    id: "m12", sport: "MMA", sportSlug: "mma",
    league: "UFC 309", leagueShort: "UFC", country: "USA",
    homeTeam: "Islam Makhachev", awayTeam: "Ilia Topuria",
    homeShort: "MAK", awayShort: "TOP",
    homeColor: "#D20A0A", awayColor: "#1F1F1F",
    homeOdds: 1.65, drawOdds: null, awayOdds: 2.40,
    startsAt: "2026-05-18T04:00:00Z", time: "Sat · 04:00",
    isLive: false, markets: 38, isHot: true,
  },
];

export const casinoGames: CasinoGame[] = [
  { id: "cg1", name: "Book of Dead", category: "Slots", provider: "Play'n GO", rtp: 96.21, minBet: 0.10, maxBet: 100, color: "#c9920a", accent: "#ffd86b", tag: "HOT", players: 412 },
  { id: "cg2", name: "Blackjack Pro", category: "Table", provider: "SportyStake", rtp: 99.50, minBet: 1, maxBet: 10000, color: "#0f6b34", accent: "#21d36b", players: 218 },
  { id: "cg3", name: "Mega Roulette", category: "Live", provider: "Pragmatic", rtp: 97.30, minBet: 0.50, maxBet: 5000, color: "#7a0e0e", accent: "#ff5a5a", tag: "JACKPOT", players: 1841 },
  { id: "cg4", name: "Crash Rocket", category: "Crash", provider: "SportyStake", rtp: 97.00, minBet: 0.10, maxBet: 500, color: "#5b21b6", accent: "#a78bfa", tag: "HOT", players: 2204 },
  { id: "cg5", name: "Sweet Bonanza", category: "Slots", provider: "Pragmatic", rtp: 96.51, minBet: 0.20, maxBet: 125, color: "#a01e60", accent: "#f472b6", players: 982 },
  { id: "cg6", name: "Dice Duel", category: "Dice", provider: "SportyStake", rtp: 99.00, minBet: 0.10, maxBet: 1000, color: "#0e6f88", accent: "#22d3ee", tag: "NEW", players: 521 },
  { id: "cg7", name: "Baccarat Live", category: "Live", provider: "Evolution", rtp: 98.76, minBet: 5, maxBet: 25000, color: "#054432", accent: "#10b981", players: 312 },
  { id: "cg8", name: "Gates of Olympus", category: "Slots", provider: "Pragmatic", rtp: 96.50, minBet: 0.20, maxBet: 125, color: "#0c2b6b", accent: "#3b82f6", tag: "HOT", players: 1432 },
  { id: "cg9", name: "Plinko XY", category: "Original", provider: "SportyStake", rtp: 99.00, minBet: 0.10, maxBet: 1000, color: "#0a4d3c", accent: "#34d399", players: 644 },
  { id: "cg10", name: "Mines", category: "Original", provider: "SportyStake", rtp: 99.00, minBet: 0.10, maxBet: 5000, color: "#3a0a4d", accent: "#a855f7", players: 388 },
  { id: "cg11", name: "Sugar Rush", category: "Slots", provider: "Pragmatic", rtp: 96.50, minBet: 0.20, maxBet: 100, color: "#7a1361", accent: "#ec4899", players: 712 },
  { id: "cg12", name: "Lightning Roulette", category: "Live", provider: "Evolution", rtp: 97.30, minBet: 0.20, maxBet: 5000, color: "#3a0c14", accent: "#ffb020", tag: "HOT", players: 1124 },
];

export const liquidityPools: LiquidityPool[] = [
  { id: "lp1", name: "Sportsbook Main", asset: "USDT", tvl: 4_250_000, apy: 12.4, volume24h: 890_000, myStake: 5000, myEarnings: 62.3, utilization: 0.62 },
  { id: "lp2", name: "Casino Reserve", asset: "USDC", tvl: 2_180_000, apy: 9.8, volume24h: 430_000, myStake: 0, myEarnings: 0, utilization: 0.48 },
  { id: "lp3", name: "High Yield", asset: "ETH", tvl: 1_640_000, apy: 18.2, volume24h: 210_000, myStake: 0, myEarnings: 0, utilization: 0.81 },
  { id: "lp4", name: "Stable Yield", asset: "USDT", tvl: 870_000, apy: 7.5, volume24h: 95_000, myStake: 0, myEarnings: 0, utilization: 0.34 },
];

export const esportsMatches: EsportsMatch[] = [
  { id: "es1", game: "CS2", gameSlug: "cs2", tournament: "ESL Pro League S21", team1: "Natus Vincere", team2: "FaZe Clan", team1Short: "NAVI", team2Short: "FaZe", team1Color: "#FFE600", team2Color: "#E40C2B", team1Odds: 2.10, team2Odds: 1.72, time: "Today · 18:00", isLive: false },
  { id: "es2", game: "Valorant", gameSlug: "valorant", tournament: "VCT Masters", team1: "Sentinels", team2: "Team Liquid", team1Short: "SEN", team2Short: "TL", team1Color: "#C8102E", team2Color: "#0044C8", team1Odds: 1.85, team2Odds: 1.95, time: "LIVE · Map 2", isLive: true },
  { id: "es3", game: "Dota 2", gameSlug: "dota2", tournament: "DreamLeague S23", team1: "Team Spirit", team2: "OG", team1Short: "TS", team2Short: "OG", team1Color: "#FFCC00", team2Color: "#1F1F1F", team1Odds: 1.60, team2Odds: 2.25, time: "Today · 21:00", isLive: false },
  { id: "es4", game: "LoL", gameSlug: "lol", tournament: "LEC Summer Split", team1: "G2 Esports", team2: "Fnatic", team1Short: "G2", team2Short: "FNC", team1Color: "#EE3D23", team2Color: "#FF6900", team1Odds: 1.45, team2Odds: 2.70, time: "Tomorrow · 17:00", isLive: false },
];

export const stats = {
  totalVolume: "124.8M",
  activePlayers: "48,204",
  poolsLiquidity: "8.94M",
  sportsMarkets: "12,400+",
  liveMarkets: 248,
};

export const promos = [
  {
    id: "p1",
    tag: "Welcome",
    title: "Wager $50, get a $25 free bet",
    subtitle: "New non-custodial wallets only · Auto-credited on first settled bet",
    cta: "Claim",
    href: "/sportsbook",
    gradient: "from-emerald-500/30 via-emerald-700/20 to-transparent",
    accent: "#00e701",
  },
  {
    id: "p2",
    tag: "Boost",
    title: "Acca insurance up to $100",
    subtitle: "Five+ legs · One leg lets you down, your stake is refunded",
    cta: "Build acca",
    href: "/sportsbook",
    gradient: "from-cyan-500/30 via-cyan-700/15 to-transparent",
    accent: "#2dc4ff",
  },
  {
    id: "p3",
    tag: "LP",
    title: "Earn up to 18.2% APY",
    subtitle: "Back the house · Real yield from sportsbook and casino margin",
    cta: "Provide liquidity",
    href: "/pools",
    gradient: "from-violet-500/30 via-violet-700/15 to-transparent",
    accent: "#a78bfa",
  },
];

export const topLeagues = [
  { slug: "epl", name: "Premier League", sport: "soccer" as const, country: "ENG", live: 3, today: 6 },
  { slug: "ucl", name: "Champions League", sport: "soccer" as const, country: "EUR", live: 1, today: 4 },
  { slug: "lal", name: "La Liga", sport: "soccer" as const, country: "ESP", live: 2, today: 5 },
  { slug: "sea", name: "Serie A", sport: "soccer" as const, country: "ITA", live: 0, today: 4 },
  { slug: "bun", name: "Bundesliga", sport: "soccer" as const, country: "GER", live: 1, today: 3 },
  { slug: "li1", name: "Ligue 1", sport: "soccer" as const, country: "FRA", live: 0, today: 2 },
  { slug: "nba", name: "NBA", sport: "basketball" as const, country: "USA", live: 4, today: 8 },
  { slug: "nhl", name: "NHL", sport: "hockey" as const, country: "USA", live: 2, today: 6 },
  { slug: "atp", name: "ATP Tour", sport: "tennis" as const, country: "INT", live: 1, today: 12 },
  { slug: "ufc", name: "UFC", sport: "mma" as const, country: "INT", live: 0, today: 1 },
];

export const sportsList = [
  { slug: "soccer" as const, name: "Soccer", count: 1284 },
  { slug: "basketball" as const, name: "Basketball", count: 312 },
  { slug: "tennis" as const, name: "Tennis", count: 188 },
  { slug: "hockey" as const, name: "Ice Hockey", count: 96 },
  { slug: "baseball" as const, name: "Baseball", count: 84 },
  { slug: "mma" as const, name: "MMA / UFC", count: 32 },
  { slug: "football" as const, name: "American FB", count: 48 },
  { slug: "cricket" as const, name: "Cricket", count: 64 },
  { slug: "rugby" as const, name: "Rugby", count: 28 },
  { slug: "volleyball" as const, name: "Volleyball", count: 44 },
  { slug: "tabletennis" as const, name: "Table Tennis", count: 56 },
  { slug: "esports" as const, name: "Esports", count: 124 },
  { slug: "horse" as const, name: "Horse Racing", count: 38 },
];
