import type { HttpClient, RequestOptions } from "../http.js";
import type {
  CreateLocalRankGridConfigInput,
  LocalRankGridConfigsResponse,
  LocalRankGridRunResult,
} from "../types.js";

/**
 * Local rank grid resource — geo-grid ORGANIC-rank tracking with heatmap
 * output (GAP-150). Requires this deployment's active SERP provider to
 * honor a per-point location override (openserp only); `runCheck` 501s
 * with `SEO_DATA_UNAVAILABLE` otherwise. Manual trigger only — nothing
 * schedules a run automatically.
 */
export class LocalRankGridResource {
  constructor(private readonly http: HttpClient) {}

  /** List this project's grid configs. */
  listConfigs(
    projectId: string,
    options?: RequestOptions,
  ): Promise<LocalRankGridConfigsResponse> {
    return this.http.get<LocalRankGridConfigsResponse>(
      "/local/rank-grid/configs",
      { projectId },
      options,
    );
  }

  /** Create a grid config. `gridSize` is fixed at 3 (9 points) for now. */
  createConfig(
    input: CreateLocalRankGridConfigInput,
    options?: RequestOptions,
  ): Promise<{ configId: string }> {
    return this.http.post<{ configId: string }>(
      "/local/rank-grid/configs",
      input,
      options,
    );
  }

  /** Delete a grid config (and its run/point history, cascaded). */
  deleteConfig(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      "/local/rank-grid/configs",
      input,
      options,
    );
  }

  /** The config's latest run (if any) plus its per-point results. */
  getLatestRun(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<{ latest: LocalRankGridRunResult | null }> {
    return this.http.get<{ latest: LocalRankGridRunResult | null }>(
      "/local/rank-grid/runs",
      input,
      options,
    );
  }

  /**
   * Run a new grid check — up to 9 live SERP calls plus up to 9 reverse-
   * geocode calls. Reports ORGANIC rank at each point, not local-pack
   * position (the free SERP backend does not parse a local pack — GAP-110).
   */
  runCheck(
    input: { projectId: string; configId: string },
    options?: RequestOptions,
  ): Promise<LocalRankGridRunResult> {
    return this.http.post<LocalRankGridRunResult>(
      "/local/rank-grid/runs",
      input,
      options,
    );
  }
}
