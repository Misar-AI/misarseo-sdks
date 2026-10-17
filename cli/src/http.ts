/**
 * Request plumbing for the CLI: bearer auth, the shared retry policy and the
 * plan-limit error. Deliberately dependency-free (global fetch, Node >= 18).
 *
 * Retry policy, identical in every MisarSEO SDK: 429 is retried for every verb
 * unless the body says `plan_limit_exceeded`; 502/503/504 and network
 * failures are retried for GET only; backoff starts at 250 ms with jitter and
 * honours `Retry-After` up to 60 s.
 */
export const VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://api.misar.io/seo";
export const PLAN_LIMIT_CODE = "plan_limit_exceeded";

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  maxRetryDelayMs?: number;
  fetch?: typeof fetch;
}

/** A non-2xx response, or (status 0) a request that never got one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PlanLimitDetails {
  status: number;
  message: string;
  body: unknown;
  /** The server's `upgrade` object: plans, prices, URLs. */
  offer: Record<string, unknown> | null;
  plan: string | undefined;
  upgradeUrl: string | undefined;
  retryAfter?: number;
}

/** The plan does not cover the call; `offer` is the server's upgrade object. */
export class PlanLimitError extends ApiError {
  readonly offer: Record<string, unknown> | null;
  readonly plan: string | undefined;
  readonly upgradeUrl: string | undefined;

  constructor(details: PlanLimitDetails) {
    super(
      details.status,
      PLAN_LIMIT_CODE,
      details.message,
      details.body,
      details.retryAfter,
    );
    this.name = "PlanLimitError";
    this.offer = details.offer;
    this.plan = details.plan;
    this.upgradeUrl = details.upgradeUrl;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function decode(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The error for a non-2xx response; the plan-limit code is checked BEFORE the status. */
export function errorFrom(
  status: number,
  headers: Headers,
  text: string,
): ApiError {
  const body = decode(text);
  const data = record(body) ?? {};
  const message = str(data.error) ?? str(data.message) ?? `HTTP ${status}`;
  const code = str(data.code) ?? "API_ERROR";
  const ra = headers.get("retry-after");
  const retryAfter = ra && /^\d+$/.test(ra.trim()) ? Number(ra) : undefined;
  if (code === PLAN_LIMIT_CODE) {
    const offer = record(data.upgrade);
    const currentPlan = record(offer?.current_plan);
    const urls = record(offer?.urls);
    return new PlanLimitError({
      status,
      message,
      body,
      offer,
      plan: headers.get("x-misar-plan") ?? str(currentPlan?.slug),
      upgradeUrl: headers.get("x-misar-upgrade-url") ?? str(urls?.pricing),
      retryAfter,
    });
  }
  return new ApiError(status, code, message, body, retryAfter);
}

export class Client {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ClientOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  url(path: string, query: Record<string, string>): string {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return `${this.baseUrl}${path}${qs ? `?${qs}` : ""}`;
  }

  headers(accept = "application/json"): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.apiKey}`,
      "Content-Type": "application/json",
      Accept: accept,
      "User-Agent": `misarseo-cli/${VERSION}`,
    };
  }

  private backoff(attempt: number, retryAfter?: number): number | null {
    const cap = this.options.maxRetryDelayMs ?? 60_000;
    if (retryAfter !== undefined)
      return retryAfter * 1000 > cap ? null : retryAfter * 1000;
    const base = (this.options.retryBaseDelayMs ?? 250) * 2 ** attempt;
    return Math.min(cap, base / 2 + Math.random() * (base / 2));
  }

  async request(
    verb: string,
    path: string,
    query: Record<string, string>,
    body?: unknown,
  ): Promise<unknown> {
    const maxRetries = this.options.maxRetries ?? 2;
    const target = this.url(path, query);
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(target, {
          method: verb,
          headers: this.headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        if (verb === "GET" && attempt < maxRetries) {
          await sleep(this.backoff(attempt) ?? 0);
          continue;
        }
        throw new ApiError(
          0,
          "NETWORK_ERROR",
          `could not reach the MisarSEO API: ${String(error)}`,
          null,
        );
      }
      const text = await response.text();
      if (response.ok) return decode(text);
      const error = errorFrom(response.status, response.headers, text);
      const retryable =
        response.status === 429 ||
        (verb === "GET" && [502, 503, 504].includes(response.status));
      if (
        error instanceof PlanLimitError ||
        !retryable ||
        attempt >= maxRetries
      )
        throw error;
      const wait = this.backoff(attempt, error.retryAfter);
      if (wait === null) throw error;
      await sleep(wait);
    }
  }

  /** GET a text/event-stream endpoint, yielding frames until a terminal event. */
  async *stream(
    path: string,
    query: Record<string, string>,
    terminal: string[],
  ): AsyncGenerator<{ event: string; data: unknown }> {
    const response = await this.fetchImpl(this.url(path, query), {
      method: "GET",
      headers: this.headers("text/event-stream"),
    });
    if (!response.ok)
      throw errorFrom(response.status, response.headers, await response.text());
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let index: number;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = parseFrame(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        if (!frame) continue;
        yield frame;
        if (terminal.includes(frame.event)) {
          await reader.cancel();
          return;
        }
      }
    }
    const last = parseFrame(buffer);
    if (last) yield last;
  }
}

/** Decode one SSE frame; null for keep-alive comments and frames without an event line. */
export function parseFrame(
  frame: string,
): { event: string; data: unknown } | null {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:"))
      data.push(line.slice(5).replace(/^ +/, ""));
  }
  if (event === null) return null;
  return { event, data: decode(data.join("\n")) ?? "" };
}
