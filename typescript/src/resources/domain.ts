import type { HttpClient, RequestOptions } from "../http.js";
import type {
  DomainBatchInput,
  DomainBatchResponse,
  DomainOverviewInput,
  DomainOverviewResponse,
  DomainAuthorityHistoryQuery,
  DomainAuthorityHistoryResponse,
  CaptureDomainAuthoritySnapshotInput,
  CaptureDomainAuthoritySnapshotResponse,
} from "../types.js";

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

  /**
   * Domain batch analysis (GAP-165/GAP-198): one authority row per domain, up
   * to 100 at once. Free — no paid provider call. Malformed entries are
   * dropped and counted in `skippedInvalid` rather than failing the request.
   *
   * `organicTraffic`, `organicKeywords`, `backlinks` and `referringDomains`
   * are always null on every row — see `organicUnavailableReason`, and use
   * `overview()` for a single domain's organic figures instead.
   */
  batchOverview(
    input: DomainBatchInput,
    options?: RequestOptions,
  ): Promise<DomainBatchResponse> {
    return this.http.post<DomainBatchResponse>(
      "/domain/batch",
      {
        projectId: input.projectId,
        domains: input.domains,
        includeSubdomains: input.includeSubdomains,
      },
      options,
    );
  }

  /**
   * Domain-authority history (GAP-086): the stored trend of dated authority
   * snapshots for one project+domain, oldest first. Empty until at least
   * one snapshot exists — see `captureAuthoritySnapshot()`, and note
   * `overview()` itself auto-captures a snapshot when `domain` is the
   * project's own domain.
   */
  authorityHistory(
    input: DomainAuthorityHistoryQuery,
    options?: RequestOptions,
  ): Promise<DomainAuthorityHistoryResponse> {
    return this.http.get<DomainAuthorityHistoryResponse>(
      "/domain/authority-history",
      { projectId: input.projectId, domain: input.domain },
      options,
    );
  }

  /**
   * Capture a domain-authority snapshot now (GAP-086): calls the same free
   * resolver `overview()` already uses and records today's reading. A
   * MUTATION, but idempotent per UTC day — a second call the same day
   * returns that day's already-recorded reading rather than writing twice.
   */
  captureAuthoritySnapshot(
    input: CaptureDomainAuthoritySnapshotInput,
    options?: RequestOptions,
  ): Promise<CaptureDomainAuthoritySnapshotResponse> {
    return this.http.post<CaptureDomainAuthoritySnapshotResponse>(
      "/domain/authority-history",
      input,
      options,
    );
  }
}
