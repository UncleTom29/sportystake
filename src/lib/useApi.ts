"use client";

import { useCallback, useEffect, useState } from "react";

interface UseApiOptions<T> {
  // Refetch interval in ms. 0 disables polling.
  interval?: number;
  // Fallback data shown while loading or on error.
  fallback?: T;
  // Re-run when these change.
  deps?: ReadonlyArray<unknown>;
  // Skip fetching when false.
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Tiny TanStack-Query-style hook for the SportyStake API client.
 * No external query lib required — uses fetch + useState/useEffect.
 *
 * The caller controls revalidation via `deps`. The `fetcher` is captured
 * by reference each time `deps` change.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  opts: UseApiOptions<T> = {},
): UseApiResult<T> {
  const { interval = 0, fallback, deps = [], enabled = true } = opts;
  const [data, setData] = useState<T | undefined>(fallback);
  const [isLoading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    run()
      .then((v) => { if (!cancelled) { setData(v); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (!cancelled) setLoading(false); });

    let id: ReturnType<typeof setInterval> | undefined;
    if (interval > 0) {
      id = setInterval(() => {
        run()
          .then((v) => { if (!cancelled) { setData(v); setError(null); } })
          .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); });
      }, interval);
    }
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [enabled, interval, run]);

  const refetch = useCallback(() => {
    setLoading(true);
    run()
      .then((v) => { setData(v); setError(null); })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [run]);

  return { data, isLoading, error, refetch };
}
