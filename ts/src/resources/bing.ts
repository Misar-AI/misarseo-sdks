import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BingSiteOverviewInput,
  BingSiteOverviewResponse,
} from "../types.js";

/**
 * Bing Webmaster resource — Bing's own view of a project's domain. Free, no
 * OAuth: the deployment operator sets `BING_WEBMASTER_API_KEY` once and it
 * covers every site verified on that Bing account.
 */
export class BingResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Search performance (daily rank/traffic + per-query stats), own-site
   * inbound links, and remaining URL Submission quota, all in one call.
   *
   * Check `ok` first: a deployment with no key, or a project whose domain
   * has no verified match on the Bing account, answers 200 with
   * `{ ok: false, reason }`. When `ok` is true, each of `rankAndTraffic` /
   * `queryStats` / `backlinks` / `submissionQuota` can still be `null` on
   * its own — with the reason in `errors` — because one Bing endpoint
   * failing does not blank the others.
   */
  siteOverview(
    input: BingSiteOverviewInput,
    options?: RequestOptions,
  ): Promise<BingSiteOverviewResponse> {
    return this.http.post<BingSiteOverviewResponse>(
      "/bing/site-overview",
      input,
      options,
    );
  }
}
