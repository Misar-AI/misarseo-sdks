import type { HttpClient, RequestOptions } from "../http.js";
import type { DomainOverviewInput, DomainOverviewResponse } from "../types.js";

/**
 * Domain resource — organic overview and domain-level keyword data.
 */
export class DomainResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get a high-level view of a domain's organic footprint:
   * estimated organic traffic, organic keyword count, domain authority, and the
   * provider that authority came from.
   * Charges credits (~100–300 typical). Cached 12 hours per domain.
   *
   * Resolves to `{ overview }`, not the metrics themselves — the route wraps
   * the service result and always has. This used to be declared as the inner
   * object, so `(await overview(...)).organicTraffic` type-checked and was
   * `undefined` on every call. Destructure it:
   *
   * ```typescript
   * const { overview } = await client.domain.overview({ ... });
   * ```
   *
   * `backlinks` and `referringDomains` are always null here; use
   * `client.backlinks.overview()` for those.
   */
  overview(
    input: DomainOverviewInput,
    options?: RequestOptions,
  ): Promise<DomainOverviewResponse> {
    return this.http.get<DomainOverviewResponse>(
      "/domain/overview",
      {
        projectId: input.projectId,
        domain: input.domain,
        includeSubdomains: input.includeSubdomains,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
      },
      options,
    );
  }
}
