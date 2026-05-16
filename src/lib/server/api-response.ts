import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "@/lib/uid";

export class ApiError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public status: number = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface OkInit {
  status?: number;
  headers?: Record<string, string>;
  requestId?: string;
}

function attachRequestId(headers: Headers, requestId: string) {
  headers.set("X-Request-Id", requestId);
}

export function ok<T>(data: T, init?: OkInit): NextResponse {
  const requestId = init?.requestId ?? nanoid();
  const res = NextResponse.json(
    { success: true, data, requestId },
    { status: init?.status ?? 200, headers: init?.headers },
  );
  attachRequestId(res.headers, requestId);
  return res;
}

export function fail(
  code: string,
  message: string,
  status: number = 400,
  init?: { details?: unknown; requestId?: string; headers?: Record<string, string> },
): NextResponse {
  const requestId = init?.requestId ?? nanoid();
  const body: Record<string, unknown> = {
    success: false,
    error: code,
    message,
    requestId,
  };
  if (init?.details !== undefined) body.details = init.details;
  const res = NextResponse.json(body, { status, headers: init?.headers });
  attachRequestId(res.headers, requestId);
  return res;
}

export function readRequestId(req: NextRequest | Request): string {
  const h = req.headers.get("x-request-id");
  return h && h.length > 0 ? h : nanoid();
}

/**
 * Wraps a route handler to:
 *  - resolve a request id
 *  - catch ApiError + ZodError + generic errors and return a normalized envelope
 */
type Handler<C> = (req: NextRequest, ctx: C, requestId: string) => Promise<NextResponse> | NextResponse;

export function withRequestId<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    const requestId = readRequestId(req);
    try {
      return await handler(req, ctx, requestId);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        return fail(err.code, err.message, err.status, { details: err.details, requestId });
      }
      // Zod errors carry an `issues` array
      const e = err as { name?: string; issues?: unknown; message?: string };
      if (e && e.name === "ZodError" && Array.isArray(e.issues)) {
        return fail("ValidationError", "Invalid request", 400, { details: e.issues, requestId });
      }
      const msg = e?.message ?? "Internal server error";
      console.error("[api] unhandled", err);
      return fail("InternalError", msg, 500, { requestId });
    }
  };
}
