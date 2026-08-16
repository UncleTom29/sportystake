/**
 * Base URL for server-side fetches from a Server Component back to this
 * app's own /api/* routes (Server Components can't use relative URLs).
 * Always the local server — frontend and API run in the same process.
 */
export function internalApiBase(): string {
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
