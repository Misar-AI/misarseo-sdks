import {
  MisarSeoAbortError,
  MisarSeoConnectionError,
  MisarSeoError,
  MisarSeoTimeoutError,
} from "./error.js";
import {
  backoffDelayMs,
  DEFAULT_RETRY_POLICY,
  isRetryable,
  parseRetryAfterMs,
  sleep,
  type HttpMethod,
  type RetryPolicy,
} from "./retry.js";

/** Query-string values the SDK knows how to serialize. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  /**
   * Per-attempt deadline in milliseconds. `0` disables it.
   * @default 30000
   */
  timeoutMs?: number;
  /**
   * Extra attempts after the first for retryable failures. `0` disables
   * retrying. See `retry.ts` for exactly what qualifies.
   * @default 2
   */
  maxRetries?: number;
  /**
   * First backoff step; doubles per retry, with jitter.
   * @default 250
   */
  retryBaseDelayMs?: number;
  /**
   * Ceiling on any single wait, including a server-supplied `Retry-After`.
   * @default 60000
   */
  maxRetryDelayMs?: number;
}

/** Per-request overrides. Every field is optional and additive. */
export interface RequestOptions {
  /**
   * Caller cancellation. Composed with the per-request timeout — whichever
   * fires first wins.
   */
  signal?: AbortSignal;
  /** Override the client's `timeoutMs` for this call. `0` disables it. */
  timeoutMs?: number;
  /** Override the client's retry budget for this call. */
  maxRetries?: number;
  /**
   * Declare this call safe to repeat, opting a non-GET method into the same
   * retry rules GET gets. Only set it when a duplicate request is genuinely
   * harmless — `keywords.save` is an upsert, so it is; `crawl.start` bills for
   * a crawl, so it is not.
   */
  idempotent?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Everything one call through the retry loop needs. */
interface SendRequest<T> {
  method: HttpMethod;
  url: string;
  /** Pre-serialized JSON body, or omitted to send none. */
  body?: string;
  options: RequestOptions;
  /** Runs only for a 2xx response. */
  consume: (response: Response) => Promise<T>;
  /**
   * Stop the timeout clock as soon as headers arrive instead of holding it
   * over the body read — for streams, whose body is meant to stay open.
   */
  headersOnlyDeadline?: boolean;
}

/**
 * Fetch wrapper used by all resource classes.
 *
 * Attaches the Authorization header, enforces a per-request deadline that
 * composes with caller cancellation, retries the failures that are safe to
 * retry, honours the API's `Retry-After` on 429, and throws typed
 * {@link MisarSeoError} subclasses carrying the server's own message and code.
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly retryPolicy: RetryPolicy;
  readonly baseUrl: string;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryPolicy = {
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries,
      baseDelayMs: config.retryBaseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
      maxDelayMs: config.maxRetryDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    };
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async get<T>(
    path: string,
    params?: QueryParams,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.send({
      method: "GET",
      url: this.buildUrl(path, params),
      options,
      consume: parseJsonBody<T>,
    });
  }

  async post<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.send({
      method: "POST",
      url: this.buildUrl(path),
      body: serializeBody(body),
      options,
      consume: parseJsonBody<T>,
    });
  }

  async patch<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.send({
      method: "PATCH",
      url: this.buildUrl(path),
      body: serializeBody(body),
      options,
      consume: parseJsonBody<T>,
    });
  }

  async delete<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.send({
      method: "DELETE",
      url: this.buildUrl(path),
      body: serializeBody(body),
      options,
      consume: parseJsonBody<T>,
    });
  }

  /**
   * GET request that returns the raw `Response` instead of parsing the body.
   * Used for streaming endpoints (Server-Sent Events) where the caller reads
   * `response.body` incrementally rather than awaiting a single JSON payload.
   *
   * The timeout covers only "response headers received" here. A crawl stream
   * legitimately stays open for minutes, and aborting the signal after headers
   * arrive would tear the body out from under the reader — so the timer is
   * disarmed once the response resolves, while the caller's own signal stays
   * wired up and can still cancel the stream mid-flight.
   */
  async getRaw(
    path: string,
    params?: QueryParams,
    options: RequestOptions = {},
  ): Promise<Response> {
    return this.send({
      method: "GET",
      url: this.buildUrl(path, params),
      options,
      consume: (response) => Promise.resolve(response),
      headersOnlyDeadline: true,
    });
  }

  private buildUrl(path: string, params?: QueryParams): string {
    const fullPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${fullPath}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /**
   * One request, plus however many retries the policy allows.
   *
   * `consume` runs only for a 2xx; every non-2xx is turned into a typed error
   * here, so callers never see a failed `Response`.
   */
  private async send<T>(request: SendRequest<T>): Promise<T> {
    const { method, url, body, options, consume } = request;
    const headersOnlyDeadline = request.headersOnlyDeadline ?? false;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const policy: RetryPolicy = {
      ...this.retryPolicy,
      maxRetries: options.maxRetries ?? this.retryPolicy.maxRetries,
    };
    const idempotent = options.idempotent ?? false;

    for (let attempt = 0; ; attempt++) {
      // Cancelled before we even opened a socket — don't.
      if (options.signal?.aborted) throw new MisarSeoAbortError();

      const deadline = startDeadline(options.signal, timeoutMs);
      let response: Response;

      try {
        response = await fetch(url, {
          method,
          headers: this.headers(),
          body,
          signal: deadline.signal,
        });
      } catch (cause) {
        deadline.release();
        // Our own timer firing and the caller cancelling are both deadlines
        // somebody set deliberately, so neither is retried. Checking the timer
        // first is what makes "whichever fires first wins" true: `timedOut` is
        // only ever set by the timer callback, and a caller abort releases the
        // timer before it can run.
        if (deadline.timedOut()) throw new MisarSeoTimeoutError(timeoutMs);
        if (options.signal?.aborted) throw new MisarSeoAbortError();

        const error = new MisarSeoConnectionError(
          `Could not reach the MisarSEO API: ${describeCause(cause)}`,
          cause,
        );
        if (
          attempt >= policy.maxRetries ||
          !isRetryable(method, undefined, idempotent)
        ) {
          throw error;
        }
        await this.pause(backoffDelayMs(attempt, policy), options.signal);
        continue;
      }

      if (response.ok) {
        // For a stream, stop the clock now: headers are in, and the body is
        // the caller's to read for as long as it takes.
        if (headersOnlyDeadline) deadline.disarmTimeout();
        try {
          return await consume(response);
        } finally {
          if (!headersOnlyDeadline) deadline.release();
        }
      }

      // Read the error body once, while the deadline still covers us, so the
      // thrown error carries the server's own message and code.
      const errorBody = await readErrorBody(response);
      deadline.release();
      const error = MisarSeoError.fromResponse(
        response.status,
        errorBody,
        response.headers,
      );
      if (
        attempt >= policy.maxRetries ||
        !isRetryable(method, response.status, idempotent)
      ) {
        throw error;
      }

      // The server knows its own window — believe `Retry-After` over our
      // guess. But a value beyond the cap is not something to sit on: throw
      // instead, with `retryAfterSeconds` on the error, and let the caller
      // decide whether waiting that long is worth it.
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
      );
      if (retryAfterMs !== null && retryAfterMs > policy.maxDelayMs)
        throw error;
      const delayMs = retryAfterMs ?? backoffDelayMs(attempt, policy);
      await this.pause(delayMs, options.signal);
    }
  }

  /** Wait between attempts, surfacing a caller cancellation immediately. */
  private async pause(
    delayMs: number,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    await sleep(delayMs, signal);
    if (signal?.aborted) throw new MisarSeoAbortError();
  }
}

/** JSON body for a mutation, or `undefined` to send no body at all. */
function serializeBody(body: unknown): string | undefined {
  return body === undefined ? undefined : JSON.stringify(body);
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  // Generic deserialization: the caller specifies the expected response shape.
  // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  if (!text) return undefined as T;
  try {
    // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return JSON.parse(text) as T;
  } catch {
    throw new MisarSeoError(
      "Invalid JSON response from MisarSEO API",
      response.status,
      "PARSE_ERROR",
    );
  }
}

/** Never throws: a broken error body must not mask the status that caused it. */
async function readErrorBody(response: Response): Promise<unknown> {
  try {
    const parsed: unknown = await response.json();
    return parsed;
  } catch {
    return null;
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * A per-request deadline, composed with the caller's cancellation.
 */
interface Deadline {
  /** Hand this to `fetch`. Undefined when there is nothing to cancel on. */
  readonly signal: AbortSignal | undefined;
  /** True only if the timer fired — i.e. the timeout won the race. */
  timedOut(): boolean;
  /** Stop the timer but keep forwarding the caller's cancellation. */
  disarmTimeout(): void;
  /** Stop the timer and detach every listener this deadline attached. */
  release(): void;
}

const noop = (): void => {};

/**
 * Compose the caller's `AbortSignal` with a fresh timeout so whichever fires
 * first aborts the request.
 *
 * `AbortSignal.any` is the correct primitive and exists in every runtime this
 * SDK supports (Node ≥ 20.3, Deno ≥ 1.39, Bun ≥ 1.0.14, all current browsers).
 * Older runtimes get the manual equivalent below: a third controller that both
 * signals forward into. The manual path deliberately drops the original abort
 * `reason` — the SDK maps the outcome to `MisarSeoTimeoutError` or
 * `MisarSeoAbortError` from its own state, so nothing user-visible reads it —
 * and `release()` detaches both listeners so a long-lived caller signal doesn't
 * accumulate one per request.
 */
function startDeadline(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Deadline {
  if (timeoutMs <= 0) {
    // Timeouts disabled: the caller's signal, if any, is the only cancellation.
    return {
      signal: callerSignal,
      timedOut: () => false,
      disarmTimeout: noop,
      release: noop,
    };
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);
  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  if (!callerSignal) {
    return {
      signal: timeoutController.signal,
      timedOut: () => timedOut,
      disarmTimeout: clearTimer,
      release: clearTimer,
    };
  }

  if (typeof AbortSignal.any === "function") {
    return {
      signal: AbortSignal.any([callerSignal, timeoutController.signal]),
      timedOut: () => timedOut,
      disarmTimeout: clearTimer,
      release: clearTimer,
    };
  }

  const composed = new AbortController();
  const onAbort = (): void => composed.abort();
  callerSignal.addEventListener("abort", onAbort, { once: true });
  timeoutController.signal.addEventListener("abort", onAbort, { once: true });
  if (callerSignal.aborted) composed.abort();

  return {
    signal: composed.signal,
    timedOut: () => timedOut,
    disarmTimeout: clearTimer,
    release: () => {
      clearTimer();
      callerSignal.removeEventListener("abort", onAbort);
      timeoutController.signal.removeEventListener("abort", onAbort);
    },
  };
}
