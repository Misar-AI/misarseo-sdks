/**
 * Minimal HTTP client for the MisarSEO REST API.
 * Duplicated here so @misar/seo-mcp has no workspace dependency on @misar/seo.
 */
export declare class MisarSeoApiError extends Error {
    readonly statusCode: number | undefined;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare class MisarSeoClient {
    private readonly apiKey;
    readonly baseUrl: string;
    constructor(apiKey: string, baseUrl: string);
    private headers;
    get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string, body?: unknown): Promise<T>;
    private handle;
}
//# sourceMappingURL=client.d.ts.map