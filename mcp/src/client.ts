/**
 * Minimal HTTP client for the MisarSEO REST API.
 * Duplicated here so @misar/seo-mcp has no workspace dependency on @misar/seo.
 */

export class MisarSeoApiError extends Error {
  readonly statusCode: number | undefined;
  readonly code: string;

  constructor(message: string, statusCode?: number, code = "MISARSEO_ERROR") {
    super(message);
    this.name = "MisarSeoApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class MisarSeoClient {
  private readonly apiKey: string;
  readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
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
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(
      `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    );
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });
    return this.handle<T>(res);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handle<T>(res);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    if (res.ok) {
      const text = await res.text();
      // Generic deserialization: the caller specifies the expected response shape.
      // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      if (!text) return undefined as T;
      // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      return JSON.parse(text) as T;
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* empty */
    }
    const b =
      body !== null && typeof body === "object"
        ? // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
          (body as Record<string, unknown>)
        : null;
    const msg =
      typeof b?.message === "string"
        ? b.message
        : `MisarSEO API error: HTTP ${res.status}`;
    const code = typeof b?.code === "string" ? b.code : "API_ERROR";
    throw new MisarSeoApiError(msg, res.status, code);
  }
}
