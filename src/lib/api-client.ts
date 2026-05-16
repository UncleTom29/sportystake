// Typed REST client used by the frontend to call the SportyStake API routes.
// All routes return { success: true, data } or { success: false, error, message }.
// `api.get` / `api.post` etc unwrap the envelope and throw ApiClientError on failure.

import type {
  MarketDTO, BetDTO, ParlayDTO, LPPositionDTO, PoolStats, UserDTO, UserStats,
  LeaderboardEntry, CasinoGameMeta, CrashRound, PredictionResult, FeedItem, QuotaStatus,
} from "@/lib/types";

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function call<T>(method: Method, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : path;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    cache: "no-store",
    ...init,
  });
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
  delete: <T,>(path: string) => call<T>("DELETE", path),
};

// --- typed endpoints ------------------------------------------------------

export const Markets = {
  list: (params?: { status?: string; leagueId?: number; featured?: boolean; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.leagueId) q.set("leagueId", String(params.leagueId));
    if (params?.featured) q.set("featured", "1");
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<{ items: MarketDTO[]; total: number }>(`/api/markets?${q}`);
  },
  live: () => api.get<{ items: MarketDTO[] }>(`/api/markets/live`),
  featured: () => api.get<{ items: MarketDTO[] }>(`/api/markets/featured`),
  today: () => api.get<{ items: MarketDTO[] }>(`/api/markets/today`),
  upcoming: () => api.get<{ items: MarketDTO[] }>(`/api/markets/upcoming`),
  search: (q: string) => api.get<{ items: MarketDTO[] }>(`/api/markets/search?q=${encodeURIComponent(q)}`),
  leagues: () => api.get<{ items: { id: number; name: string; logo?: string; country: string; countryCode: string; matchesToday: number; live: number; total: number }[] }>(`/api/markets/leagues`),
  detail: (id: string) => api.get<MarketDTO>(`/api/markets/${id}`),
  stats: (id: string) => api.get<unknown>(`/api/markets/${id}/stats`),
  pool: (id: string) => api.get<PoolStats>(`/api/markets/${id}/pool`),
};

export const Bets = {
  place: (body: { marketId: string; marketType: string; outcome: number; selectionLabel: string; amount: string; oddsX1000: number; slippageToleranceBps?: number; isLive?: boolean; isPublic?: boolean; copyOfBetId?: string; }) =>
    api.post<{ bet: BetDTO; estimatedConfirmationMs: number }>(`/api/bets`, body),
  parlay: (body: { selections: { marketId: string; marketType: string; outcome: number; selectionLabel: string; oddsX1000: number }[]; totalStake: string; isPublic?: boolean }) =>
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
  claim: (id: string) => api.post<{ bet: BetDTO; txHash?: string; payoutUsdc: string }>(`/api/bets/${id}/claim`),
  myStats: () => api.get<UserStats>(`/api/bets/stats/me`),
  leaderboard: (period: "weekly" | "monthly" | "alltime" = "weekly") =>
    api.get<{ items: LeaderboardEntry[] }>(`/api/bets/stats/leaderboard?period=${period}`),
};

export const Liquidity = {
  markets: () => api.get<{ items: { market: MarketDTO; pool: PoolStats }[] }>(`/api/liquidity/markets`),
  market: (marketId: string) => api.get<{ market: MarketDTO; pool: PoolStats }>(`/api/liquidity/markets/${marketId}`),
  myPositions: () => api.get<{ items: LPPositionDTO[] }>(`/api/liquidity/my-positions`),
  deposit: (marketId: string, amount: string) => api.post<{ position: LPPositionDTO }>(`/api/liquidity/deposit`, { marketId, amount }),
  requestWithdraw: (marketId: string) => api.post<{ position: LPPositionDTO; timelockHours: number }>(`/api/liquidity/withdraw/request`, { marketId }),
  executeWithdraw: (marketId: string) => api.post<{ position: LPPositionDTO; payoutUsdc: string }>(`/api/liquidity/withdraw/execute`, { marketId }),
};

export const Casino = {
  games: () => api.get<{ items: CasinoGameMeta[] }>(`/api/casino/games`),
  bet: (body: Record<string, unknown>) => api.post<{ outcome: { win: boolean; payout: string; detail: Record<string, unknown> }; game: string }>(`/api/casino/bet`, body),
  history: () => api.get<{ items: unknown[] }>(`/api/casino/history/me`),
  crashState: () => api.get<{ round: CrashRound; history: number[] }>(`/api/casino/crash/state`),
  crashJoin: (amount: string, autoCashoutX100?: number) => api.post<{ round: CrashRound }>(`/api/casino/crash/join`, { amount, autoCashoutX100 }),
  crashCashout: () => api.post<{ round: CrashRound; cashedOutAtX100: number }>(`/api/casino/crash/cashout`),
  crashHistory: () => api.get<{ items: { id: number; crashMultiplierX100: number; at?: string }[] }>(`/api/casino/crash/history`),
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
  nonce: (address: string) => api.get<{ nonce: string; expiresInSeconds: number }>(`/api/auth/nonce?address=${address}`),
  verify: (body: { message: string; signature: string } | { dev: { address: string } }) =>
    api.post<{ user: UserDTO; tokens: { accessToken: string } }>(`/api/auth/verify`, body),
  me: () => api.get<{ user: UserDTO; stats: UserStats }>(`/api/auth/me`),
  logout: () => api.delete<{ loggedOut: boolean }>(`/api/auth/logout`),
  refresh: () => api.post<{ user: UserDTO }>(`/api/auth/refresh`),
};

export const Admin = {
  overview: () => api.get<unknown>(`/api/admin/analytics/overview`),
  quota: () => api.get<QuotaStatus>(`/api/admin/analytics/quota`),
  riskExposure: () => api.get<{ items: { marketId: string; label: string; coverageRatio: number; riskLevel: string }[] }>(`/api/admin/risk/exposure`),
  riskAlerts: () => api.get<{ items: { marketId: string; label: string; coverage: number }[] }>(`/api/admin/risk/alerts`),
  users: () => api.get<{ items: { user: UserDTO; stats: UserStats }[] }>(`/api/admin/users`),
  ban: (id: string) => api.post<{ user: UserDTO }>(`/api/admin/users/${id}/ban`),
  unban: (id: string) => api.post<{ user: UserDTO }>(`/api/admin/users/${id}/unban`),
  settleMarket: (id: string, winningOutcome: number) =>
    api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/settle`, { winningOutcome }),
  suspendMarket: (id: string) => api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/suspend`),
  cancelMarket: (id: string) => api.post<{ market: MarketDTO }>(`/api/admin/markets/${id}/cancel`),
  toggleFeatured: (id: string) => api.patch<{ market: MarketDTO }>(`/api/admin/markets/${id}/featured`),
};

export const Health = {
  basic: () => api.get<{ status: string; timestamp: string; counts: Record<string, number>; quota: QuotaStatus }>(`/api/health`),
  detailed: () => api.get<unknown>(`/api/health/detailed`),
};
