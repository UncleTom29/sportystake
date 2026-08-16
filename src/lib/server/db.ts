/**
 * Singleton Prisma client. Re-used across the server runtime — including HMR
 * in development — so we don't exhaust the Postgres connection pool every
 * time a file is edited.
 */
import { PrismaClient } from "@prisma/client";
import { serverEnv } from "@/lib/env";

declare global {

  var __prisma: PrismaClient | undefined;
}

function build(): PrismaClient {
  let url = serverEnv.DATABASE_URL;
  if (!url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=30&pool_timeout=15`;
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log:
      serverEnv.NODE_ENV === "production"
        ? ["error"]
        : ["warn", "error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? build();

if (serverEnv.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export type { Prisma } from "@prisma/client";
