import type { HttpClient, RequestOptions } from "../http.js";
import type {
  CreateLocalPackRankConfigInput,
  LocalPackRankConfigsResponse,
  LocalPackRankCheckResult,
} from "../types.js";

/**
 * Local pack rank resource — where ONE named business sits in Google's
 * local pack for one keyword+location (GAP-110). Distinct from
 * `localRankGrid` (GAP-150), which plots ORGANIC rank for a DOMAIN across a
 * geo-grid: this checks LOCAL-PACK rank for a named BUSINESS at a single
 * point. `runCheck` scrapes Google's own public local search results page
 * directly — a real, but fragile and undocumented surface, off by default
 * on the server (`LOCAL_PACK_SCRAPER_ENABLED`) — and 501s with
 * `SEO_DATA_UNAVAILABLE` when that flag is unset. Manual trigger only.
 */
export class LocalPackRankResource {
  constructor(private readonly http: HttpClient) {}

  /** List this project's local pack rank check configs. */
  listConfigs(
    projectId: string,
    options?: RequestOptions,
  ): Promise<LocalPackRankConfigsResponse> {
    return this.http.get<LocalPackRankConfigsResponse>(
      "/local/local-pack-rank/configs",
      { projectId },
      options,
    );
  }

  /** Create a local pack rank check config. */
  createConfig(
    input: CreateLocalPackRankConfigInput,
    options?: RequestOptions,
  ): Promise<{ configId: string }> {
    return this.http.post<{ configId: string }>(
      "/local/local-pack-rank/configs",
      input,
      options,
    );
  }

  /** Delete a local pack rank check config (and its check history, cascaded). */
  deleteConfig(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      "/local/local-pack-rank/configs",
      input,
      options,
    );
  }

  /** The config's latest check, if any. */
  getLatestCheck(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<{ latest: LocalPackRankCheckResult["check"] | null }> {
    return this.http.get<{ latest: LocalPackRankCheckResult["check"] | null }>(
      "/local/local-pack-rank/checks",
      input,
      options,
    );
  }

  /**
   * Run a new local pack rank check — one live scrape of Google's public
   * local search results page. Returns `status: "found"` with a real
   * 1-based `position`, `"not_found"` (parsed cleanly, business absent from
   * what was seen), or `"unavailable"` (disabled/blocked/unparsable) —
   * never a fabricated position or confidence score.
   */
  runCheck(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<LocalPackRankCheckResult> {
    return this.http.post<LocalPackRankCheckResult>(
      "/local/local-pack-rank/checks",
      input,
      options,
    );
  }
}
