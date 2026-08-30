/**
 * Retry policy for the MisarSEO SDK's HTTP layer.
 *
 * Kept separate from `http.ts` so the classification rules can be read — and
 * unit-tested — as pure functions, without a fetch in the way.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RetryPolicy {
  /** Extra attempts after the first one. `0` disables retrying entirely. */
  maxRetries: number;
  /** First backoff step; doubles per attempt. */
  baseDelayMs: number;
  /**
   * Ceiling on any single wait, including one the server asked for via
   * `Retry-After`. A hostile or misconfigured `Retry-After: 86400` must not
   * park a caller's process for a day.
   */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 250,
  maxDelayMs: 60_000,
};

/**
 * Whether a failed attempt is worth repeating.
 *
 * **What gets retried, and why:**
 *
 * - **429, for every method.** The server's rate-limit check runs immediately
 *   after authentication and before any work (see `checkRateLimit` usage in
 *   `src/routes/api/seo/*`), so a 429 is a pre-execution refusal: nothing was
 *   written, no upstream was called, no credits were spent. That makes it the
 *   one failure a POST can safely repeat.
 *
 * - **502 / 503 / 504 and transport failures, for GET only.** GET is *safe* in
 *   the HTTP sense — it has no side effects at all, so a duplicate is
 *   invisible. POST and PATCH may already have been applied server-side when
 *   the connection dropped or the gateway gave up, and several of them charge
 *   credits or start a crawl; repeating one can double-bill. DELETE is
 *   idempotent by RFC but not safe: a retried DELETE that actually succeeded
 *   the first time comes back 404, turning a success into an error the caller
 *   never earned. So neither is retried automatically — pass
 *   `{ idempotent: true }` per call to opt a specific mutation in.
 *
 * **What is never retried:**
 *
 * - Any other 4xx (400, 401, 402, 403, 404, 409). These are deterministic
 *   verdicts on the request as sent; the same bytes will fail identically
 *   forever, so retrying only wastes the caller's time and quota.
 * - 500 and 501. A 500 is an unhandled bug in the API — repeating it just
 *   multiplies it — and 501 (`SEO_DATA_UNAVAILABLE`) is a permanent statement
 *   that no accurate source exists for the metric.
 * - Timeouts and caller cancellation. Both are deadlines somebody set on
 *   purpose; see `http.ts`.
 *
 * @param status HTTP status, or `undefined` for a transport failure (no response).
 * @param treatAsIdempotent Caller's per-request opt-in for non-GET methods.
 */
export function isRetryable(
  method: HttpMethod,
  status: number | undefined,
  treatAsIdempotent: boolean,
): boolean {
  if (status === 429) return true;
  if (method !== "GET" && !treatAsIdempotent) return false;
  // No response at all: the request may never have reached the server.
  if (status === undefined) return true;
  return status === 502 || status === 503 || status === 504;
}

/**
 * Exponential backoff with equal jitter: half the delay is fixed so each
 * attempt genuinely waits longer than the last, half is random so a fleet of
 * clients that failed together doesn't come back in lockstep and re-create the
 * pile-up they're backing off from.
 *
 * @param attempt Zero-based index of the retry about to be scheduled.
 */
export function backoffDelayMs(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** attempt;
  const capped = Math.min(exponential, policy.maxDelayMs);
  return capped / 2 + Math.random() * (capped / 2);
}

/**
 * Parse a `Retry-After` header into milliseconds.
 *
 * RFC 9110 allows two forms and the API uses the first, but a proxy in front
 * of it may rewrite to the second, so both are handled:
 *   - delta-seconds, a non-negative integer (`Retry-After: 30`)
 *   - an HTTP-date (`Retry-After: Wed, 21 Oct 2015 07:28:00 GMT`)
 *
 * Returns `null` for a missing or unparseable value, which the caller reads as
 * "the server didn't say — use your own backoff". A date already in the past
 * clamps to 0 rather than going negative.
 */
export function parseRetryAfterMs(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  // Integer seconds, the only numeric form the spec allows.
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;

  // Numeric-looking but invalid (negative, fractional): reject outright rather
  // than handing it to Date.parse, which reads "-5" as the year 5 BC and would
  // turn a malformed header into a silent "retry immediately".
  if (/^[+-]?\d*\.?\d+$/.test(trimmed)) return null;

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - nowMs);
}

/**
 * Sleep, waking early if the caller cancels.
 *
 * Resolves rather than rejects on abort: the retry loop re-checks the signal
 * straight after and raises the one canonical abort error, so this stays a
 * plain delay with no error semantics of its own.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
