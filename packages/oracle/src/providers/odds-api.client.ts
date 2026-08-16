/**
 * Production Odds-API.io v3 client.
 *
 * Enforces:
 *  - Single gateway via QuotaBudgetManager (priority-gated before every call)
 *  - Header-driven quota updates after every response
 *  - Exponential backoff retry on 429/5xx
 *
 * NEVER add caching here — all caching is the responsibility of the job layer.
 */

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import type { OddsApiEvent, OddsApiOddsResponse } from '../types/odds-api.types.js';
import type { IFootballProvider, ProviderStatus } from './provider.interface.js';
import {
  QuotaExhaustedError,
  HOURLY_QUOTA,
  type Priority,
  type QuotaBudgetManager,
  type QuotaStatus,
} from '../quota/quota-budget-manager.js';
import type { Logger } from 'pino';

interface RequestOpts {
  path: string;
  params?: Record<string, string | number | string[]>;
  priority: Priority;
}

export interface OddsApiClientOpts {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  quota: QuotaBudgetManager;
  logger: Logger;
}

export class OddsApiClient implements IFootballProvider {
  private readonly http: AxiosInstance;
  private readonly quota: QuotaBudgetManager;
  private readonly logger: Logger;
  private readonly maxRetries: number;
  private readonly apiKey: string;
  private bookmakerLookupPromise?: Promise<Map<string, string>>;
  private selectedBookmakersPromise?: Promise<Set<string>>;

  constructor(opts: OddsApiClientOpts) {
    if (!opts.apiKey) throw new Error('OddsApiClient: apiKey is required');
    this.quota = opts.quota;
    this.logger = opts.logger.child({ provider: 'odds-api' });
    this.maxRetries = opts.maxRetries;
    this.apiKey = opts.apiKey;
    this.http = axios.create({
      baseURL: opts.baseUrl,
      timeout: opts.timeoutMs,
      validateStatus: () => true,
    });
  }

  getQuotaStatus(): QuotaStatus {
    return this.quota.getStatus();
  }

  async getStatus(): Promise<ProviderStatus> {
    const q = this.quota.getStatus();
    return {
      account: { firstname: 'Odds', lastname: 'API', email: 'odds-api.io' },
      subscription: { plan: 'Free', end: '2099-12-31', active: true },
      requests: { current: q.used, limit_day: HOURLY_QUOTA },
    };
  }

  // ─── /events/live ──────────────────────────────────────────────────────────
  async getLiveEvents(sport?: string): Promise<OddsApiEvent[]> {
    return this.request<OddsApiEvent[]>({
      path: '/events/live',
      params: sport ? { sport } : undefined,
      priority: 'critical',
    });
  }

  // ─── /events?status=pending ────────────────────────────────────────────────
  async getUpcomingEvents(sport = 'football'): Promise<OddsApiEvent[]> {
    const now = new Date();
    const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return this.request<OddsApiEvent[]>({
      path: '/events',
      params: {
        sport,
        status: 'pending',
        from: now.toISOString(),
        to: to.toISOString(),
      },
      priority: 'high',
    });
  }

  // ─── /odds ─────────────────────────────────────────────────────────────────
  async getOddsByEvent(eventId: number, bookmakers: string[]): Promise<OddsApiOddsResponse | null> {
    const safeBookmakers = await this.normalizeBookmakers(bookmakers);
    const result = await this.request<OddsApiOddsResponse>({
      path: '/odds',
      params: { eventId, bookmakers: safeBookmakers.join(',') },
      priority: 'low',
    });
    return result ?? null;
  }

  // ─── /odds/multi ────────────────────────────────────────────────────────────
  async getMultiOdds(eventIds: number[], bookmakers: string[]): Promise<OddsApiOddsResponse[]> {
    if (eventIds.length === 0) return [];
    const safeBookmakers = await this.normalizeBookmakers(bookmakers);
    // API supports up to 10 event IDs per call.
    const chunks = chunkArray(eventIds, 10);
    const results: OddsApiOddsResponse[] = [];
    for (const chunk of chunks) {
      const batch = await this.request<OddsApiOddsResponse[]>({
        path: '/odds/multi',
        params: { eventIds: chunk.join(','), bookmakers: safeBookmakers.join(',') },
        priority: 'low',
      });
      if (Array.isArray(batch)) results.push(...batch);
    }
    return results;
  }

  // ─── core request loop ──────────────────────────────────────────────────────
  private async request<T>(opts: RequestOpts): Promise<T> {
    if (!this.quota.canMakeRequest(opts.priority)) {
      throw new QuotaExhaustedError(opts.priority, this.quota.getStatus());
    }

    const params = { ...opts.params as Record<string, unknown>, apiKey: this.apiKey };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.http.get<T>(opts.path, { params });

        await this.recordFromHeaders(res);

        if (res.status === 429) {
          const wait = backoffMs(attempt, res);
          this.logger.warn({ path: opts.path, wait }, 'rate-limited');
          await sleep(wait);
          continue;
        }
        if (res.status >= 500) {
          const wait = backoffMs(attempt, res);
          this.logger.warn({ status: res.status, path: opts.path, wait }, 'upstream-5xx');
          await sleep(wait);
          continue;
        }
        if (res.status === 404) {
          return (opts.path === '/odds/multi' ? [] : null) as T;
        }
        if (res.status !== 200) {
          const upstreamError = extractErrorMessage(res.data);
          throw new Error(`odds-api ${opts.path} returned ${res.status}${upstreamError ? `: ${upstreamError}` : ''}`);
        }
        return res.data;
      } catch (err) {
        lastError = err;
        const axiosErr = err as AxiosError;
        if (
          attempt < this.maxRetries &&
          (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNRESET')
        ) {
          const wait = backoffMs(attempt);
          this.logger.warn({ code: axiosErr.code, path: opts.path, wait }, 'network-error');
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? new Error(`odds-api ${opts.path}: exhausted retries`);
  }

  private async recordFromHeaders(res: AxiosResponse<unknown>): Promise<void> {
    const remaining = res.headers['x-ratelimit-remaining'];
    await this.quota.recordRequest(remaining as string | number | null | undefined);
  }

  private async normalizeBookmakers(bookmakers: string[]): Promise<string[]> {
    const cleaned = Array.from(new Set(bookmakers.map((b) => b.trim()).filter(Boolean)));
    if (cleaned.length === 0) return cleaned;

    try {
      const [lookup, selectedSet] = await Promise.all([
        this.getBookmakerLookup(),
        this.getSelectedBookmakers(),
      ]);

      const normalized = cleaned.map((raw) => lookup.get(raw.toLowerCase()) ?? raw);
      const unresolved = cleaned.filter((raw) => !lookup.has(raw.toLowerCase()));
      if (unresolved.length > 0) {
        this.logger.warn({ unresolved }, 'bookmakers:unknown');
      }

      if (selectedSet.size === 0) return normalized;

      const allowed = normalized.filter((name) => selectedSet.has(name.toLowerCase()));
      if (allowed.length > 0) return allowed;

      const fallbackLower = Array.from(selectedSet.values())[0];
      const fallback = lookup.get(fallbackLower) ?? fallbackLower;
      this.logger.warn({ requested: normalized, fallback }, 'bookmakers:using-selected-fallback');
      return [fallback];
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'UNKNOWN';
      this.logger.warn({ provider: 'odds-api', err: code }, 'bookmakers:catalog-fetch-failed');
      return cleaned;
    }
  }

  private async getBookmakerLookup(): Promise<Map<string, string>> {
    this.bookmakerLookupPromise ??= this.request<Array<{ name: string; active?: boolean }>>({
      path: '/bookmakers',
      priority: 'low',
    }).then((rows) => {
      const map = new Map<string, string>();
      for (const row of rows ?? []) {
        if (!row?.name) continue;
        map.set(row.name.toLowerCase(), row.name);
      }
      return map;
    });

    return this.bookmakerLookupPromise;
  }

  private async getSelectedBookmakers(): Promise<Set<string>> {
    this.selectedBookmakersPromise ??= this.request<{ bookmakers?: string[] }>({
      path: '/bookmakers/selected',
      priority: 'low',
    }).then((payload) => {
      const out = new Set<string>();
      for (const name of payload?.bookmakers ?? []) {
        out.add(String(name).toLowerCase());
      }
      return out;
    });

    return this.selectedBookmakersPromise;
  }
}

function backoffMs(attempt: number, res?: AxiosResponse<unknown>): number {
  const retryAfter = res?.headers?.['retry-after'];
  if (retryAfter) {
    const n = Number(retryAfter);
    if (Number.isFinite(n) && n > 0) return Math.min(30_000, n * 1000);
  }
  const base = 500 * 2 ** attempt;
  const jitter = Math.random() * 250;
  return Math.min(15_000, base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractErrorMessage(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const val = (data as { error?: unknown }).error;
    return typeof val === 'string' ? val : '';
  }
  return '';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
