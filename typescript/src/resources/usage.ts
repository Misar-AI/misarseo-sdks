import type { HttpClient, RequestOptions } from "../http.js";
import type { GetUsageResponse } from "../types.js";

/**
 * Plan/credit/quota usage transparency (GAP-197) resource — this codebase's
 * answer to Ahrefs' `subscription-info-limits-and-usage`.
 *
 * Free — every figure it reports is read from a counter this codebase
 * already maintains for its own gating; nothing here calls a paid provider.
 */
export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Plan tier, credits remaining, and every quota/count dimension tracked
   * against it for the caller's organization. `gatingActive` is false on a
   * self-hosted deployment with no billing provider configured — `tier`,
   * `creditsRemaining` and `quotas` are all `null` there. `used: null` inside
   * a quota dimension means NOT TRACKED (an unlimited tier's counter is
   * never written), never a real zero.
   */
  get(options?: RequestOptions): Promise<GetUsageResponse> {
    return this.http.get<GetUsageResponse>("/usage", undefined, options);
  }
}
