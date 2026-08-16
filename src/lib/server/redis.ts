/**
 * Singleton Redis client for cache + pub/sub consumption from the oracle.
 * Separate publisher/subscriber connections per ioredis best practice: a
 * subscriber connection cannot run regular commands.
 */
import Redis from "ioredis";
import { serverEnv } from "@/lib/env";

declare global {

  var __redis: { main?: Redis; sub?: Redis } | undefined;
}

const store = globalThis.__redis ?? (globalThis.__redis = {});

function build(): Redis {
  const r = new Redis(serverEnv.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  r.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[redis] error", err.message);
  });
  return r;
}

export function redis(): Redis {
  if (!store.main) {
    store.main = build();
    void store.main.connect().catch(() => {});
  }
  return store.main;
}

export function redisSubscriber(): Redis {
  if (!store.sub) {
    store.sub = build();
    void store.sub.connect().catch(() => {});
  }
  return store.sub;
}

// Publisher uses the main connection (ioredis prohibits commands on subscriber connections).
export const redisPublisher = redis;
