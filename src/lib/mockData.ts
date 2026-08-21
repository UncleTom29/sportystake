/**
 * @deprecated Static fixtures used by pages that haven't migrated to the
 * real API yet. The runtime data is now served from:
 *   - `Markets.list()` / `Markets.live()` / `Markets.detail(id)`  → matches
 *   - `Casino.games()`                                            → casinoGames
 *   - `Liquidity.pool()`                                          → the single, protocol-wide pool
 *
 * The TYPE exports (`Match`, `CasinoGame`, etc.) remain valid and are still
 * used as the structural shape inside `MatchCard`, `GameTile`, etc. Pages
 * that import the const arrays below should be migrated to fetch+useState
 * (see `LiveScoreTicker.tsx` for the canonical pattern).
 *
 * Tracked in PRODUCTION_TODO.md → P1 "Replace mockData.ts consumption".
 */
import type { SportSlug } from "@/components/icons/SportIcons";

import type { OddsBundle } from "./types";

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
  status?: string;
  odds?: OddsBundle[];
};

export type CasinoGame = {
  id: string;
  name: string;
  href: string;
  category: "Slots" | "Table" | "Crash" | "Dice";
  provider: string;
  /** Derived from the on-chain house edge (houseEdgeBps in src/lib/server/casino.ts), not a marketing figure. */
  rtp: number;
  minBet: number;
  maxBet: number;
  color: string;
  accent: string;
  tag?: "HOT" | "NEW";
  description: string;
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

// Every game here is real — built on CasinoHouse.sol / CrashGame.sol, signed
// on-chain via Circle, settled by the operator. RTP is `100% - houseEdgeBps/100`
// straight from src/lib/server/casino.ts, not a marketing number.
export const casinoGames: CasinoGame[] = [
  { id: "crash", name: "Aviator", href: "/casino/crash", category: "Crash", provider: "SportyStake", rtp: 99.00, minBet: 1, maxBet: 5000, color: "#5b21b6", accent: "#a78bfa", tag: "HOT", description: "Cash out before the plane flies away. Commit-reveal on-chain." },
  { id: "dice", name: "Dice", href: "/casino/dice", category: "Dice", provider: "SportyStake", rtp: 99.00, minBet: 1, maxBet: 5000, color: "#0e6f88", accent: "#22d3ee", tag: "HOT", description: "Roll over or under. Adjust the threshold, adjust the odds." },
  { id: "slots", name: "Slots", href: "/casino/slots", category: "Slots", provider: "SportyStake", rtp: 96.50, minBet: 1, maxBet: 5000, color: "#a01e60", accent: "#f472b6", tag: "HOT", description: "5 reels, provably-fair symbol grid. Wilds pay big." },
  { id: "roulette", name: "Roulette", href: "/casino/roulette", category: "Table", provider: "SportyStake", rtp: 97.30, minBet: 1, maxBet: 5000, color: "#7a0e0e", accent: "#ff5a5a", tag: "NEW", description: "European single-zero wheel. Straight-up pays 36×." },
  { id: "blackjack", name: "Blackjack", href: "/casino/blackjack", category: "Table", provider: "SportyStake", rtp: 99.50, minBet: 1, maxBet: 5000, color: "#0f6b34", accent: "#21d36b", tag: "NEW", description: "Beat the dealer's 17 without busting." },
  { id: "baccarat", name: "Baccarat", href: "/casino/baccarat", category: "Table", provider: "SportyStake", rtp: 98.80, minBet: 1, maxBet: 5000, color: "#054432", accent: "#10b981", tag: "NEW", description: "Player, Banker, or Tie — closest to 9 wins." },
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
  sportsMarkets: "12,400+",
  liveMarkets: 248,
};

export const promos = [
  {
    id: "p1",
    tag: "Welcome Bonus",
    title: "100% Match up to $2,000 Wager Bonus",
    subtitle: "100% bonus match on your first settled wager on-chain · No KYC required · T&C apply",
    cta: "Claim $2,000 Bonus",
    href: "/sportsbook",
    gradient: "from-emerald-500/35 via-emerald-700/20 to-transparent",
    accent: "#00e701",
    tnc: "100% bonus match up to $2,000 USDC on your first settled wager. Non-custodial Web3 settlement. Terms apply.",
  },
  {
    id: "p2",
    tag: "Lifetime Referrals",
    title: "Earn Lifetime Revenue Cut from Wagers",
    subtitle: "Invite friends & get a perpetual percentage of all wagers placed by your referred users for life · T&C apply",
    cta: "Get Referral Link",
    href: "/profile",
    gradient: "from-cyan-500/35 via-cyan-700/20 to-transparent",
    accent: "#2dc4ff",
    tnc: "Referrers receive up to 25% house margin share on all settled wagers. No earnings cap. Terms apply.",
  },
  {
    id: "p3",
    tag: "Affiliate Promo",
    title: "Earn on Shared Bet Tickets",
    subtitle: "Share your bet slips on X & Telegram · Earn instant affiliate commissions whenever users copy your ticket code",
    cta: "Share & Earn",
    href: "/sportsbook",
    gradient: "from-amber-500/35 via-amber-700/20 to-transparent",
    accent: "#ffb800",
    tnc: "Earn 2% on total wagered volume copied via your shared ticket code (e.g. ST-7X9K2).",
  },
  {
    id: "p4",
    tag: "AI Auto-Pilot",
    title: "Autonomous Quant Betting Studio",
    subtitle: "Deploy institutional algorithmic betting circuits with non-custodial session delegation · Real-time +EV execution",
    cta: "Launch Auto-Pilot",
    href: "/ai-analytics",
    gradient: "from-emerald-500/35 via-emerald-700/20 to-transparent",
    accent: "#00e701",
    tnc: "Non-custodial ERC-4337 smart session keys with strict daily budget caps and zero withdrawal authority.",
  },
  {
    id: "p5",
    tag: "Instant Payouts",
    title: "Sub-Second On-Chain Settlement",
    subtitle: "All sportsbook & casino payouts settled 100% on-chain with 18ms block finality · Direct to your self-custody wallet",
    cta: "Explore Markets",
    href: "/sportsbook",
    gradient: "from-cyan-500/35 via-blue-700/20 to-transparent",
    accent: "#2dc4ff",
    tnc: "All sports & casino payouts backed 100% on-chain by audited smart contract escrow vaults.",
  },
  {
    id: "p6",
    tag: "Free AI Intelligence",
    title: "Free LLM Powered Analytics & Match Insights",
    subtitle: "Claude Fable AI powered predictive analytics for every fixture · Real-time value odds & AI match circuits · 100% Free",
    cta: "Open AI Analytics",
    href: "/ai-analytics",
    gradient: "from-sky-500/35 via-indigo-700/20 to-transparent",
    accent: "#38bdf8",
    tnc: "Free LLM sports predictions & value odds analysis available to all connected Web3 wallets.",
  },
];

export const topLeagues = [
  { slug: "epl", name: "Premier League", sport: "football" as const, country: "ENG", live: 0, today: 0 },
  { slug: "ucl", name: "Champions League", sport: "football" as const, country: "EUR", live: 0, today: 0 },
  { slug: "lal", name: "La Liga", sport: "football" as const, country: "ESP", live: 0, today: 0 },
  { slug: "sea", name: "Serie A", sport: "football" as const, country: "ITA", live: 0, today: 0 },
  { slug: "bun", name: "Bundesliga", sport: "football" as const, country: "GER", live: 0, today: 0 },
  { slug: "li1", name: "Ligue 1", sport: "football" as const, country: "FRA", live: 0, today: 0 },
  { slug: "nba", name: "NBA", sport: "basketball" as const, country: "USA", live: 0, today: 0 },
  { slug: "nhl", name: "NHL", sport: "ice-hockey" as const, country: "USA", live: 0, today: 0 },
  { slug: "atp", name: "ATP Tour", sport: "tennis" as const, country: "INT", live: 0, today: 0 },
  { slug: "ufc", name: "UFC", sport: "mixed-martial-arts" as const, country: "INT", live: 0, today: 0 },
];

export const sportsList = [
  { slug: "football" as const, name: "Football", count: 0 },
  { slug: "basketball" as const, name: "Basketball", count: 0 },
  { slug: "tennis" as const, name: "Tennis", count: 0 },
  { slug: "baseball" as const, name: "Baseball", count: 0 },
  { slug: "american-football" as const, name: "American Football", count: 0 },
  { slug: "ice-hockey" as const, name: "Ice Hockey", count: 0 },
  { slug: "esports" as const, name: "Esports", count: 0 },
  { slug: "darts" as const, name: "Darts", count: 0 },
  { slug: "mixed-martial-arts" as const, name: "MMA", count: 0 },
  { slug: "boxing" as const, name: "Boxing", count: 0 },
  { slug: "handball" as const, name: "Handball", count: 0 },
  { slug: "volleyball" as const, name: "Volleyball", count: 0 },
  { slug: "snooker" as const, name: "Snooker", count: 0 },
  { slug: "table-tennis" as const, name: "Table Tennis", count: 0 },
  { slug: "rugby" as const, name: "Rugby", count: 0 },
  { slug: "cricket" as const, name: "Cricket", count: 0 },
  { slug: "water-polo" as const, name: "Waterpolo", count: 0 },
  { slug: "futsal" as const, name: "Futsal", count: 0 },
  { slug: "beach-volleyball" as const, name: "Beach Volley", count: 0 },
  { slug: "aussie-rules" as const, name: "Aussie Rules", count: 0 },
  { slug: "floorball" as const, name: "Floorball", count: 0 },
  { slug: "squash" as const, name: "Squash", count: 0 },
  { slug: "beach-soccer" as const, name: "Beach Soccer", count: 0 },
  { slug: "lacrosse" as const, name: "Lacrosse", count: 0 },
  { slug: "curling" as const, name: "Curling", count: 0 },
  { slug: "padel" as const, name: "Padel", count: 0 },
  { slug: "bandy" as const, name: "Bandy", count: 0 },
  { slug: "gaelic-football" as const, name: "Gaelic Football", count: 0 },
  { slug: "beach-handball" as const, name: "Beach Handball", count: 0 },
  { slug: "athletics" as const, name: "Athletics", count: 0 },
  { slug: "badminton" as const, name: "Badminton", count: 0 },
  { slug: "cross-country" as const, name: "Cross-Country", count: 0 },
  { slug: "golf" as const, name: "Golf", count: 0 },
  { slug: "cycling" as const, name: "Cycling", count: 0 },
];
