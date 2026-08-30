/**
 * Minimal HTTP client for the MisarSEO REST API.
 * Duplicated here so @misar/seo-mcp has no workspace dependency on @misar/seo.
 */
export class MisarSeoApiError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code = "MISARSEO_ERROR") {
        super(message);
        this.name = "MisarSeoApiError";
        this.statusCode = statusCode;
        this.code = code;
    }
}
export class MisarSeoClient {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    headers() {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    async get(path, params) {
        const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined)
                    url.searchParams.set(k, String(v));
            }
        }
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: this.headers(),
        });
        return this.handle(res);
    }
    async post(path, body) {
        const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return this.handle(res);
    }
    async delete(path, body) {
        const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
        const res = await fetch(url, {
            method: "DELETE",
            headers: this.headers(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return this.handle(res);
    }
    async handle(res) {
        if (res.ok) {
            const text = await res.text();
            // Generic deserialization: the caller specifies the expected response shape.
            // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
            if (!text)
                return undefined;
            // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
            return JSON.parse(text);
        }
        let body = null;
        try {
            body = await res.json();
        }
        catch {
            /* empty */
        }
        const b = body !== null && typeof body === "object"
            ? // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
                body
            : null;
        const msg = typeof b?.message === "string"
            ? b.message
            : `MisarSEO API error: HTTP ${res.status}`;
        const code = typeof b?.code === "string" ? b.code : "API_ERROR";
        throw new MisarSeoApiError(msg, res.status, code);
    }
}
//# sourceMappingURL=client.js.map