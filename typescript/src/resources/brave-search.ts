import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BraveSearchRankCheckInput,
  BraveSearchRankCheckResponse,
} from "../types.js";

/**
 * Brave Search resource (GAP-204) — checks where a project's domain (or an
 * explicit `targetDomain`) ranks in REAL Brave Search results for one
 * keyword. Brave has run its own independent crawler and index since 2023,
 * so this is a genuinely separate data point from every free-tier SERP
 * source in this SDK — never blended into a free-tier rank number.
 *
 * Bring-your-own-key, operator-level: the deployment sets
 * `BRAVE_SEARCH_API_KEY` once (a single paid credential, no OAuth flow).
 * Every call spends that key's Brave Search API budget.
 */
export class BraveSearchResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Check `ok` first: a deployment with no `BRAVE_SEARCH_API_KEY`, or a
   * request with no `targetDomain` and no project `domain` to fall back on,
   * answers `{ ok: false, reason }` rather than a hard error.
   *
   * Makes exactly one paid Brave Search API call — `depth` (max 20) is
   * Brave's own per-request ceiling, never paginated to search deeper.
   */
  rankCheck(
    input: BraveSearchRankCheckInput,
    options?: RequestOptions,
  ): Promise<BraveSearchRankCheckResponse> {
    return this.http.post<BraveSearchRankCheckResponse>(
      "/brave-search/rank-check",
      input,
      options,
    );
  }
}
