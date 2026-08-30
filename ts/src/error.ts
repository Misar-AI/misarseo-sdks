/**
 * Errors thrown by the MisarSEO SDK on non-2xx responses, transport failures,
 * timeouts, and caller cancellation.
 *
 * Everything still extends {@link MisarSeoError}, so existing
 * `catch (e) { if (e instanceof MisarSeoError) … }` code keeps working. The
 * subclasses exist so a caller can branch on *what to do next* — back off,
 * re-authenticate, top up credits, fix the request — rather than comparing
 * status numbers or string-matching messages at the call site.
 *
 * The wire shape is `{ error: string, code?: string }` — see `jsonError` in
 * `src/server/lib/api-auth.ts`. `code` is one of the canonical values in
 * `src/shared/error-codes.ts` and is preserved verbatim, because the status
 * alone is lossy: a 403 is `FORBIDDEN`, `BACKLINKS_NOT_ENABLED`, or
 * `CRAWL_TARGET_BLOCKED`, and a 402 is `INSUFFICIENT_CREDITS` or
 * `PLAN_FEATURE_LOCKED` — same status, different remedy.
 */
import { parseRetryAfterMs } from "./retry.js";

/**
 * Base class for every SDK error. Thrown directly for statuses that have no
 * more specific subclass (409, 500, 501, …), always carrying the server's own
 * `code` so nothing is lost by not having a dedicated class.
 */
export class MisarSeoError extends Error {
  /** HTTP status, or `undefined` when the request never got a response. */
  readonly statusCode: number | undefined;
  /** The API's `code` field, or a transport-level code the SDK assigned. */
  readonly code: string;

  constructor(message: string, statusCode?: number, code = "MISARSEO_ERROR") {
    super(message);
    this.name = "MisarSeoError";
    this.statusCode = statusCode;
    this.code = code;
  }

  /**
   * Build the most specific error subclass for an API response.
   *
   * `headers` is optional only for backwards compatibility with callers that
   * predate it; pass it whenever available so a 429 carries `Retry-After`.
   */
  static fromResponse(
    statusCode: number,
    body: unknown,
    headers?: Headers,
  ): MisarSeoError {
    const parsed = parseErrorBody(body);
    const message = parsed.message ?? `MisarSEO API error: HTTP ${statusCode}`;
    const code = parsed.code ?? "API_ERROR";

    switch (statusCode) {
      case 400:
        return new MisarSeoValidationError(message, code);
      case 401:
        return new MisarSeoAuthenticationError(message, code);
      case 402:
        return new MisarSeoPaymentRequiredError(message, code);
      case 403:
        return new MisarSeoPermissionError(message, code);
      case 404:
        return new MisarSeoNotFoundError(message, code);
      case 429:
        return new MisarSeoRateLimitError(
          message,
          code,
          retryAfterSeconds(headers),
        );
      case 502:
      case 503:
      case 504:
        return new MisarSeoUpstreamError(message, statusCode, code);
      default:
        return new MisarSeoError(message, statusCode, code);
    }
  }
}

/** 400 — the request was malformed or failed schema validation. Never retried. */
export class MisarSeoValidationError extends MisarSeoError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, 400, code);
    this.name = "MisarSeoValidationError";
  }
}

/** 401 — missing, malformed, revoked, or expired API key. */
export class MisarSeoAuthenticationError extends MisarSeoError {
  constructor(message: string, code = "UNAUTHENTICATED") {
    super(message, 401, code);
    this.name = "MisarSeoAuthenticationError";
  }
}

/**
 * 402 — the call is understood and allowed but not paid for: out of credits,
 * a billing problem on a metered add-on, or a feature the plan tier locks.
 */
export class MisarSeoPaymentRequiredError extends MisarSeoError {
  constructor(message: string, code = "PAYMENT_REQUIRED") {
    super(message, 402, code);
    this.name = "MisarSeoPaymentRequiredError";
  }
}

/**
 * 403 — authenticated but not permitted: insufficient org role, an add-on the
 * connected DataForSEO account lacks, or a crawl target policy refused.
 */
export class MisarSeoPermissionError extends MisarSeoError {
  constructor(message: string, code = "FORBIDDEN") {
    super(message, 403, code);
    this.name = "MisarSeoPermissionError";
  }
}

/** 404 — no such project, audit, tracker, or comparison baseline. */
export class MisarSeoNotFoundError extends MisarSeoError {
  constructor(message: string, code = "NOT_FOUND") {
    super(message, 404, code);
    this.name = "MisarSeoNotFoundError";
  }
}

/**
 * 429 — rate limited, at capacity, or over a plan quota.
 *
 * `retryAfterSeconds` is the server's own `Retry-After` when it sent one. The
 * SDK already waits and retries within its budget; this error means the wait
 * was longer than the configured cap or the budget was exhausted, so the
 * decision is back with the caller.
 */
export class MisarSeoRateLimitError extends MisarSeoError {
  /** Seconds the server asked us to wait, when it said. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    code = "RATE_LIMITED",
    retryAfterSecondsValue?: number,
  ) {
    super(message, 429, code);
    this.name = "MisarSeoRateLimitError";
    this.retryAfterSeconds = retryAfterSecondsValue;
  }
}

/**
 * 502 / 503 / 504 — a third-party upstream (DataForSEO, GSC, …) or the gateway
 * in front of the API failed. Distinct from a 500, which is a bug in the API
 * itself and will fail the same way on a retry.
 */
export class MisarSeoUpstreamError extends MisarSeoError {
  constructor(
    message: string,
    statusCode: number,
    code = "UPSTREAM_UNAVAILABLE",
  ) {
    super(message, statusCode, code);
    this.name = "MisarSeoUpstreamError";
  }
}

/**
 * The request never produced a response — DNS failure, refused connection,
 * TLS error, socket reset. There is no status because nothing came back.
 */
export class MisarSeoConnectionError extends MisarSeoError {
  constructor(message: string, cause?: unknown) {
    super(message, undefined, "CONNECTION_ERROR");
    this.name = "MisarSeoConnectionError";
    this.cause = cause;
  }
}

/** The per-request deadline elapsed before the response arrived. */
export class MisarSeoTimeoutError extends MisarSeoError {
  /** The deadline that elapsed, in milliseconds. */
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `MisarSEO API request timed out after ${timeoutMs}ms`,
      undefined,
      "TIMEOUT",
    );
    this.name = "MisarSeoTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The caller's own `AbortSignal` fired. Separate from
 * {@link MisarSeoTimeoutError} so "I cancelled this" is never confused with
 * "the server was too slow" — the two want opposite reactions.
 */
export class MisarSeoAbortError extends MisarSeoError {
  constructor(message = "MisarSEO API request was aborted by the caller") {
    super(message, undefined, "ABORTED");
    this.name = "MisarSeoAbortError";
  }
}

interface ParsedErrorBody {
  message: string | undefined;
  code: string | undefined;
}

/**
 * Pull the message and code out of an error body.
 *
 * The API sends `{ error, code }`; `message` is accepted as a fallback so a
 * response shaped by a proxy or an older deployment still surfaces something
 * better than "HTTP 500".
 */
function parseErrorBody(body: unknown): ParsedErrorBody {
  if (body === null || typeof body !== "object") {
    return { message: undefined, code: undefined };
  }
  // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const fields = body as Record<string, unknown>;
  const error = fields.error;
  const message = fields.message;
  const code = fields.code;
  return {
    message:
      typeof error === "string" && error
        ? error
        : typeof message === "string" && message
          ? message
          : undefined,
    code: typeof code === "string" && code ? code : undefined,
  };
}

/** `Retry-After` as whole seconds, for the error a caller inspects. */
function retryAfterSeconds(headers: Headers | undefined): number | undefined {
  const ms = parseRetryAfterMs(headers?.get("retry-after") ?? null);
  return ms === null ? undefined : Math.ceil(ms / 1000);
}
