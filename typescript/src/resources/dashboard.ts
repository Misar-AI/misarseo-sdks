import type { HttpClient, RequestOptions } from "../http.js";
import type { GetDashboardResponse } from "../types.js";

/**
 * Cross-project dashboard (GAP-190) resource.
 *
 * Free — reads MisarSEO's own Postgres directly across every active project
 * in the caller's organization, no upstream calls: GSC and backlinks are
 * deliberately excluded from the card data, so calling this never spends a
 * Search Console quota unit or a paid-provider credit.
 */
export class DashboardResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * One card per active project: latest audit health, rank-tracker status,
   * and trailing-7-day web-analytics sessions. `audit`/`rankTracking`/
   * `webAnalytics` are `null` on a card whose project has none of that data
   * yet — a real "not set up" fact, not a zero standing in for missing data.
   */
  get(options?: RequestOptions): Promise<GetDashboardResponse> {
    return this.http.get<GetDashboardResponse>(
      "/dashboard",
      undefined,
      options,
    );
  }
}
