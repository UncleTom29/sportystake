// Typed REST client used by the frontend to call the SportyStake API routes.
// All routes return { success: true, data } or { success: false, error, message }.
// `api.get` / `api.post` etc unwrap the envelope and throw ApiClientError on failure.

import type {
  MarketDTO, BetDTO, ParlayDTO, LPPositionDTO, PoolStats, UserDTO, UserStats,
  LeaderboardEntry, CasinoGameMeta, PredictionResult, FeedItem, QuotaStatus,
} from "@/lib/types";

/** On-chain-backed crash round state — written by crash-scheduler.worker.ts, read from Redis. */
export interface OnchainCrashRound {
  id: number;
  status: "waiting" | "running" | "crashed";
  serverSeedHash: string;
  waitingSince: number;
  startedAt?: number;
  crashMultiplierX100?: number;
  serverSeed?: string;
}

export interface BlackjackHandResult {
  casinoBetId: string;
  actionSeq: number;
  status: "player_turn" | "resolved";
  playerHands: { cards: number[]; done: boolean }[];
  dealerUpCard?: number; // player_turn only — hole card withheld
  dealerCards?: number[]; // resolved only — full reveal
  outcome?: string;
  multiplier?: number;
  bonusGated?: boolean;
  payout?: string;
  win?: boolean;
  fairness?: { serverSeedHash: string; serverSeed?: string; clientSeed: string; nonce: number };
}

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * The access token (`ss_access`) is a 15-minute JWT — it routinely expires
 * mid-session, and nothing proactively rotates it before that happens.
 * `WalletSync` only runs its own refresh-and-retry dance once, on the root
 * provider's mount (i.e. on a hard page load) — every other page's own data
 * fetch went through this `call()` with no equivalent, so once the token
 * expired, every such fetch just 401'd. Several pages swallow that silently
 * (`.catch(() => {})`), so the page just sits there showing stale/empty
 * data with no visible error — indistinguishable from "genuinely has no
 * data" — until a hard reload re-runs WalletSync and gets a fresh token.
 * That's the exact "so many pages refuse to load until I refresh" report.
 *
 * Fixed once, here, rather than in each page: on a 401 (excluding the auth
 * endpoints themselves, to avoid recursing into the refresh flow), try
 * exactly one silent refresh-and-replay before surfacing an error.
 *
 * The refresh token is single-use and rotating server-side (see
 * /api/auth/refresh's own doc comment — presenting an already-rotated jti
 * is treated as a leak) — so this must never let two callers refresh
 * concurrently, or the loser's retry would itself fail. All 401s share one
 * in-flight refresh promise instead of each starting their own.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function call<T>(method: Method, path: string, body?: unknown, init?: RequestInit, isRetry = false): Promise<T> {
  const url = path.startsWith("http") ? path : path;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    cache: "no-store",
    ...init,
  });

  if (res.status === 401 && !isRetry && !path.startsWith("/api/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return call<T>(method, path, body, init, true);
    }
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiClientError("InvalidResponse", `Bad response from ${path}`, res.status);
  }
  if (!res.ok || (json as { success?: boolean }).success === false) {
    const j = json as { error?: string; message?: string; details?: unknown };
    throw new ApiClientError(j.error ?? "Error", j.message ?? res.statusText, res.status, j.details);
  }
  return (json as { data: T }).data;
}

export const api = {
  get:  <T,>(path: string) => call<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => call<T>("POST", path, body),
  patch: <T,>(path: string, body?: unknown) => call<T>("PATCH", path, body),
  put:  <T,>(path: string, body?: unknown) => call<T>("PUT", path, body),
  delete: <T,>(path: string, init?: RequestInit) => call<T>("DELETE", path, undefined, init),
};

// --- typed endpoints ------------------------------------------------------

export const Markets = {
  list: (params?: { status?: string; leagueId?: number; sport?: string; featured?: boolean; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.leagueId) q.set("leagueId", String(params.leagueId));
    if (params?.sport) q.set("sport", params.sport);
    if (params?.featured) q.set("featured", "1");
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: MarketDTO[]; total: number }>(`/api/markets?${q}`);
  },
  live: (sport?: string, leagueId?: number) => {
    const q = new URLSearchParams();
    if (sport) q.set("sport", sport);
    if (leagueId) q.set("leagueId", String(leagueId));
    return api.get<{ items: MarketDTO[] }>(`/api/markets/live${q.toString() ? `?${q}` : ""}`);
  },
  featured: () => api.get<{ items: MarketDTO[]; total: number }>(`/api/markets/featured`),
  today: (sport?: string, leagueId?: number) => {
    const q = new URLSearchParams();
    if (sport) q.set("sport", sport);
    if (leagueId) q.set("leagueId", String(leagueId));
    return api.get<{ items: MarketDTO[] }>(`/api/markets/today${q.toString() ? `?${q}` : ""}`);
  },
  upcoming: (sport?: string, leagueId?: number) => {
    const q = new URLSearchParams();
    if (sport) q.set("sport", sport);
    if (leagueId) q.set("leagueId", String(leagueId));
    return api.get<{ items: MarketDTO[] }>(`/api/markets/upcoming${q.toString() ? `?${q}` : ""}`);
  },
  tomorrow: (sport?: string, leagueId?: number) => {
    const q = new URLSearchParams();
    if (sport) q.set("sport", sport);
    if (leagueId) q.set("leagueId", String(leagueId));
    return api.get<{ items: MarketDTO[]; total: number }>(`/api/markets/tomorrow${q.toString() ? `?${q}` : ""}`);
  },
  outright: (sport?: string, leagueId?: number) => {
    const q = new URLSearchParams();
    if (sport) q.set("sport", sport);
    if (leagueId) q.set("leagueId", String(leagueId));
    return api.get<{ items: MarketDTO[]; total: number }>(`/api/markets/outright${q.toString() ? `?${q}` : ""}`);
  },
  search: (q: string) => api.get<{ items: MarketDTO[] }>(`/api/markets/search?q=${encodeURIComponent(q)}`),
  leagues: (sport?: string) => api.get<{ items: { id: number; name: string; logo?: string; sport: string; country: string; countryCode: string; matchesToday: number; live: number; total: number }[] }>(`/api/markets/leagues${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`),
  sports: () => api.get<{ items: { sport: string; total: number; live: number; today: number }[]; totals: { total: number; live: number; today: number } }>(`/api/markets/sports`),
  detail: (id: string) => api.get<MarketDTO>(`/api/markets/${id}`),
  stats: (id: string) => api.get<unknown>(`/api/markets/${id}/stats`),
};

export const Bets = {
  // The bet is already placed and confirmed on-chain by the time this is
  // called (see src/lib/placeBet.ts) — this just persists the verified
  // receipt. marketType/selectionLabel are display metadata only.
  place: (body: { txHash: string; marketType: string; selectionLabel: string; isLive?: boolean; isPublic?: boolean }) =>
    api.post<{ bet: BetDTO }>(`/api/bets`, body),
  parlay: (body: { txHash: string; legs: { marketId: string; selectionLabel: string; marketType?: string; oddsX1000?: number }[]; isPublic?: boolean }) =>
    api.post<{ parlay: ParlayDTO }>(`/api/bets/parlay`, body),
  my: (params?: { status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: BetDTO[]; total: number }>(`/api/bets/my?${q}`);
  },
  publicFeed: (limit = 30) => api.get<{ items: BetDTO[] }>(`/api/bets/public?limit=${limit}`),
  detail: (id: string) => api.get<BetDTO>(`/api/bets/${id}`),
  claim: (id: string, txHash: string) =>
    api.post<{ bet: BetDTO; payoutUsdc: string }>(`/api/bets/${id}/claim`, { txHash }),
  refund: (id: string, txHash: string) =>
    api.post<{ bet: BetDTO; refundUsdc: string }>(`/api/bets/${id}/refund`, { txHash }),
  claimParlay: (parlayId: string, txHash: string) =>
    api.post<{ parlay: { id: string; status: string; potentialPayout: string }; payoutUsdc: string }>(
      `/api/bets/parlay/${parlayId}/claim`, { txHash },
    ),
  refundParlay: (parlayId: string, txHash: string) =>
    api.post<{ parlay: { id: string; status: string }; refundUsdc: string }>(
      `/api/bets/parlay/${parlayId}/refund`, { txHash },
    ),
  myStats: () => api.get<UserStats>(`/api/bets/stats/me`),
  leaderboard: (period: "weekly" | "monthly" | "alltime" = "weekly") =>
    api.get<{ items: LeaderboardEntry[] }>(`/api/bets/stats/leaderboard?period=${period}`),
};

export const BetSlip = {
  book: (selections: unknown[]) =>
    api.post<{ code: string; totalOdds: number; itemCount: number; selections: any[]; createdAt: string; expiresAt: string }>(
      `/api/betslip/book`,
      { selections }
    ),
  loadBooked: (code: string) =>
    api.get<{ code: string; totalOdds: number; itemCount: number; selections: any[]; createdAt: string; expiresAt: string }>(
      `/api/betslip/book/${code}`
    ),
};

export const Liquidity = {
  /** The single, protocol-wide LiquidityPool's aggregate stats. */
  pool: () => api.get<{ pool: PoolStats }>(`/api/liquidity/pool`),
  myPositions: () => api.get<{ items: LPPositionDTO[]; total: number }>(`/api/liquidity/my-positions`),
  deposit: (amount: string, txHash?: string) => api.post<{ position: LPPositionDTO }>(`/api/liquidity/deposit`, { amount, txHash }),
  requestWithdraw: () => api.post<{ position: LPPositionDTO; timelockHours: number }>(`/api/liquidity/withdraw/request`),
  executeWithdraw: (txHash?: string) => api.post<{ position: LPPositionDTO; payoutUsdc: string }>(`/api/liquidity/withdraw/execute`, { txHash }),
};

export const Casino = {
  games: () => api.get<{ items: CasinoGameMeta[] }>(`/api/casino/games`),
  bet: (body: Record<string, unknown>) => api.post<{
    outcome: { win: boolean; payout: string; multiplier: number; detail: Record<string, unknown> };
    fairness: { serverSeedHash: string; serverSeed: string; clientSeed: string; nonce: number };
    game: string;
    settled: boolean;
  }>(`/api/casino/bet`, body),
  history: () => api.get<{ items: unknown[] }>(`/api/casino/history/me`),
  // The bet/cashout/claim are already confirmed on-chain by the time these
  // are called (see src/lib/crashClient.ts) — txHash is the receipt to verify.
  crashState: () => api.get<{ round: OnchainCrashRound | null; history: number[] }>(`/api/casino/crash/state`),
  crashJoin: (txHash: string, clientSeed: string) =>
    api.post<{ roundId: number; amount: string }>(`/api/casino/crash/join`, { txHash, clientSeed }),
  crashCashout: (txHash: string) =>
    api.post<{ cashedOutAtX100: number }>(`/api/casino/crash/cashout`, { txHash }),
  crashClaim: (txHash: string) => api.post<{ amount: string }>(`/api/casino/crash/claim`, { txHash }),
  crashHistory: () => api.get<{ items: { id: number; crashMultiplierX100: number; at?: string }[] }>(`/api/casino/crash/history`),
  dealBlackjack: (body: { txHash: string; clientSeed: string }) =>
    api.post<BlackjackHandResult>(`/api/casino/blackjack/deal`, body),
  blackjackAction: (body: { casinoBetId: string; action: "hit" | "stand"; actionSeq: number }) =>
    api.post<BlackjackHandResult>(`/api/casino/blackjack/action`, body),
};

export const Analytics = {
  predict: (marketId: string) => api.post<PredictionResult>(`/api/analytics/predict`, { marketId }),
  valueScanner: () => api.get<{ items: { marketId: string; market: string; selection: string; outcome: number; bookmakerOdds: number; aiProbability: number; edge: number }[] }>(`/api/analytics/value-scanner`),
};

export const Social = {
  feed: (limit = 30) => api.get<{ items: FeedItem[] }>(`/api/social/feed?limit=${limit}`),
  like: (id: string) => api.post<{ likes: number }>(`/api/social/feed/${id}/like`),
  follow: (userId: string) => api.post<{ following: boolean }>(`/api/social/follow/${userId}`),
  unfollow: (userId: string) => api.delete<{ following: boolean }>(`/api/social/follow/${userId}`),
};

export const Auth = {
  privyVerify: (identityToken: string) =>
    api.post<{ user: UserDTO }>(`/api/auth/privy/session`, { identityToken }),
  me: () => api.get<{ user: UserDTO; stats: UserStats }>(`/api/auth/me`),
  logout: () => api.delete<{ loggedOut: boolean }>(`/api/auth/logout`),
  refresh: () => api.post<{ user: UserDTO }>(`/api/auth/refresh`),
};

export const Favourites = {
  list: () => api.get<{ marketIds: string[]; leagueIds: number[]; total: number; requiresAuth: boolean }>(`/api/favourites`),
  saveMarket: (marketId: string) => api.post<{ saved: boolean }>(`/api/favourites`, { type: "market", marketId }),
  removeMarket: (marketId: string) => api.delete<{ removed: boolean }>(`/api/favourites`, { body: JSON.stringify({ type: "market", marketId }) }),
  saveLeague: (leagueId: number) => api.post<{ saved: boolean }>(`/api/favourites`, { type: "league", leagueId }),
  removeLeague: (leagueId: number) => api.delete<{ removed: boolean }>(`/api/favourites`, { body: JSON.stringify({ type: "league", leagueId }) }),
};

export interface AdminAnalyticsOverview {
  ggr: { today: string; week: string; month: string };
  volume: { today: string; week: string; month: string };
  activeUsersToday: number;
  bets: number;
  lpTvl: string;
  openLpMarkets: number;
}

export const Admin = {
  overview: () => api.get<AdminAnalyticsOverview>(`/api/admin/analytics/overview`),
  quota: () => api.get<QuotaStatus>(`/api/admin/analytics/quota`),
  riskExposure: () =>
    api.get<{
      pool: { tvl: string; virtualLiquidity: string; effectiveCapacity: string; lockedForPayouts: string };
      items: { marketId: string; label: string; closesAt: string; totalBetAmount: string; maxLiability: string; coverageRatio: number; riskLevel: "safe" | "warning" | "critical" }[];
    }>(`/api/admin/risk/exposure`),
  riskAlerts: () => api.get<{ items: { marketId: string; label: string; coverage: number }[] }>(`/api/admin/risk/alerts`),
  users: () => api.get<{ items: { user: UserDTO; stats: UserStats }[] }>(`/api/admin/users`),
  ban: (id: string) => api.post<{ user: UserDTO }>(`/api/admin/users/${id}/ban`),
  unban: (id: string) => api.post<{ user: UserDTO }>(`/api/admin/users/${id}/unban`),
  updateUserRole: (id: string, roles: string[]) => api.patch<{ user: UserDTO }>(`/api/admin/users/${id}/role`, { roles }),
  listMarkets: (params?: { status?: string; q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: (MarketDTO & { betsCount?: number })[]; total: number }>(`/api/admin/markets?${q}`);
  },
  resumeMarket: (id: string) => api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/resume`),
  /**
   * Sports markets: pass the final score — every market type with bets on
   * it (1X2, totals, BTTS, asian handicap) resolves automatically. Prediction
   * markets or a manual override for one market type the score resolver
   * can't handle: pass an explicit winningOutcome (+ optional marketType).
   */
  settleMarket: (id: string, input: { homeScore: number; awayScore: number } | { winningOutcome: number; marketType?: string }) =>
    api.post<{ market: MarketDTO; won: number; voided: number; unresolved: string[] }>(`/api/admin/markets/${id}/settle`, input),
  suspendMarket: (id: string) => api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/suspend`),
  cancelMarket: (id: string) => api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/cancel`),
  toggleFeatured: (id: string) => api.patch<{ market: MarketDTO }>(`/api/admin/markets/${id}/featured`),
  getConfig: () => api.get<{ config: { houseEdgeBps: number; minBetUsdc: string; maxBetUsdc: string; treasuryAddress: string; isPaused: boolean; maxMultipliers: Record<string, number> } }>(`/api/admin/system/config`),
  updateConfig: (body: Record<string, unknown>) => api.post<{ config: unknown }>(`/api/admin/system/config`, body),
  casinoBets: (params?: { game?: string; status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.game) q.set("game", params.game);
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: { id: string; game: string; amount: string; multiplierX100?: number; payout: string; status: string; requestId?: string; placedAt: string; user: { id: string; walletAddress: string; username?: string } }[]; total: number }>(`/api/admin/casino?${q}`);
  },
  settleCasinoBet: (id: string, body: { status: "WON" | "LOST" | "REFUNDED" | "CANCELLED"; payoutUsdc?: string }) =>
    api.post<{ bet: { id: string; status: string; payout: string } }>(`/api/admin/casino/${id}/settle`, body),
  auditLogs: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: { id: string; action: string; target?: string; ip?: string; createdAt: string; actor?: { username?: string; walletAddress: string } }[]; total: number }>(`/api/admin/audit?${q}`);
  },
};

export const Health = {
  basic: () => api.get<{ status: string; timestamp: string; counts: Record<string, number>; quota: QuotaStatus }>(`/api/health`),
  detailed: () => api.get<unknown>(`/api/health/detailed`),
};

export const UserApi = {
  setUsername: (username: string) => api.post<{ user: UserDTO }>(`/api/user/username`, { username }),
  checkUsername: (username: string) => api.get<{ available: boolean; reason?: string }>(`/api/user/username/check?username=${encodeURIComponent(username)}`),
};

export const LeaderboardApi = {
  get: (params?: { category?: string; period?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.period) q.set("period", params.period);
    return api.get<{
      items: {
        rank: number;
        userId: string;
        handle: string;
        address: string;
        walletAddress: string;
        username?: string;
        color: string;
        verified: boolean;
        bets: number;
        winRate: number;
        volume: number;
        pnl: number;
        roi: number;
        streak: number;
      }[];
      total: number;
      currentUser?: {
        rank: number;
        handle: string;
        address: string;
        bets: number;
        winRate: number;
        volume: number;
        pnl: number;
        roi: number;
        streak: number;
      } | null;
    }>(`/api/leaderboard?${q}`);
  },
};

export const SocialApi = {
  feed: (limit = 30) => api.get<{ items: any[] }>(`/api/social/feed?limit=${limit}`),
  tipsters: () => api.get<{ items: any[] }>(`/api/social/tipsters`),
};

export const AIAnalytics = {
  get: (forceRefresh = false) =>
    api.get<{
      lastAnalyzedAt: string;
      modelUsed: string;
      predictions: {
        id: string;
        marketId: string;
        match: string;
        league: string;
        pick: string;
        marketType?: string;
        confidence: number;
        odds: number;
        fair: number;
        impliedProb?: number;
        trueProb?: number;
        expectedValuePct?: number;
        kellyUnits?: number;
        xgDiff?: string;
        form?: string[];
        grade?: "GRADE A+" | "GRADE A" | "GRADE B+" | "GRADE B";
        valueBps: number;
        reasoning: string;
        factors: string[];
        direction: "up" | "down";
        kickoff?: string;
      }[];
      insights: { tag: string; title: string; desc: string; accent: string }[];
      trackRecord?: {
        winRate: number;
        roi: number;
        avgClvBeat: number;
        totalPicks: number;
        verifiedPeriod: string;
        unitsWon: number;
      };
    }>(`/api/ai-analytics${forceRefresh ? "?refresh=true" : ""}`),
  recalibrate: () =>
    api.post<{
      lastAnalyzedAt: string;
      modelUsed: string;
      predictions: any[];
      insights: any[];
      trackRecord: any;
    }>("/api/ai-analytics", {}),
};


