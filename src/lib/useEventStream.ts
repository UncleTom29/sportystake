"use client";

import { useEffect, useRef } from "react";

export interface EventStreamMessage {
  topic: string;
  payload: unknown;
  at: number;
}

/**
 * Subscribes to /api/socket via EventSource for the requested topics.
 * Reconnects with exponential backoff. Calls `onEvent` for each message.
 */
export function useEventStream(
  topics: string[],
  onEvent: (msg: EventStreamMessage) => void,
  opts?: { enabled?: boolean }
): void {
  const enabled = opts?.enabled !== false;
  const handlerRef = useRef(onEvent);

  // Sync the latest callback into the ref each commit, without touching it
  // during render — required by React 19 strict rules.
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const topicsKey = topics.join(",");
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || topicsKey.length === 0) return;
    let es: EventSource | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let backoff = 500;
    let closed = false;

    const connect = () => {
      const url = `/api/socket?topics=${encodeURIComponent(topicsKey)}`;
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => { backoff = 500; };
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as EventStreamMessage;
          if (parsed?.topic && parsed.topic !== "hello") handlerRef.current(parsed);
        } catch {
          // ignore malformed payload
        }
      };
      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        timeout = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15_000);
      };
    };
    connect();

    return () => {
      closed = true;
      if (timeout) clearTimeout(timeout);
      es?.close();
    };
  }, [enabled, topicsKey]);
}
