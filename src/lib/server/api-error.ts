/**
 * Standardized API error responses. Use these in every route to keep error
 * shapes consistent and to ensure stack traces never leak to the client.
 */
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { serverEnv } from "@/lib/env";

export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "upstream_unavailable"
  | "internal_error";

const STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  upstream_unavailable: 503,
  internal_error: 500,
};

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
  details?: unknown;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: code, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status: STATUS[code] });
}

export function validationError(error: ZodError): NextResponse<ApiErrorBody> {
  return apiError("validation_error", "invalid request", {
    issues: error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code,
    })),
  });
}

/**
 * Wrap a route handler to convert thrown errors into well-formed JSON
 * responses. Never reveals stack traces in production.
 */
export function withErrorHandling<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R | NextResponse<ApiErrorBody>> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const isDev = serverEnv.NODE_ENV !== "production";
      // eslint-disable-next-line no-console
      console.error("[api]", err);
      const message = err instanceof Error ? err.message : "unknown error";
      return apiError(
        "internal_error",
        isDev ? message : "internal server error",
        isDev && err instanceof Error ? { stack: err.stack?.split("\n").slice(0, 4) } : undefined,
      );
    }
  };
}
