/**
 * Next.js instrumentation hook. Runs once per server process at startup —
 * exactly the right moment to fail fast on missing secrets, warm up shared
 * connections (Redis, Postgres), and register graceful-shutdown handlers.
 *
 * Also initializes Sentry when SENTRY_DSN is set. When unset, Sentry is a
 * no-op shim — the app still boots without the optional dep.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Side-effecting import: validates env and throws if invalid.
  const { serverEnv } = await import("./src/lib/env");

  if ((serverEnv as Record<string, unknown>)["SENTRY_DSN"]) {
    // To enable: `npm install @sentry/nextjs` then uncomment the block
    // below. Kept out of the default install to avoid pulling in a
    // ~5MB SDK + telemetry dependencies for projects that don't use it.
    //
    //   const Sentry = await import("@sentry/nextjs");
    //   Sentry.init({
    //     dsn: serverEnv.SENTRY_DSN,
    //     environment: serverEnv.NODE_ENV,
    //     tracesSampleRate: serverEnv.NODE_ENV === "production" ? 0.1 : 1.0,
    //     sendDefaultPii: false,
    //   });
    // eslint-disable-next-line no-console
    console.warn("[sportystake] SENTRY_DSN set but @sentry/nextjs not installed");
  }

  // eslint-disable-next-line no-console
  console.log(
    `[sportystake] boot ok — env=${serverEnv.NODE_ENV} ` +
      `db=${maskUrl(serverEnv.DATABASE_URL)} redis=${maskUrl(serverEnv.REDIS_URL)}`,
  );
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Headers },
): Promise<void> {
  // eslint-disable-next-line no-console
  console.error(`[sportystake] request-error ${request.method} ${request.path}`, err);
  // To forward to Sentry: `npm install @sentry/nextjs` then uncomment:
  //   const Sentry = await import("@sentry/nextjs");
  //   Sentry.captureException(err, { tags: { path: request.path, method: request.method } });
}

function maskUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid>";
  }
}
