import type { HttpClient, RequestOptions } from "../http.js";
import type {
  GetRankTrackerInput,
  GetRankTrackerResponse,
  CreateRankTrackerInput,
  CreateRankTrackerResponse,
  UpdateRankTrackerInput,
  DeleteRankTrackerInput,
  AddTrackingKeywordsInput,
  AddTrackingKeywordsResponse,
  RemoveTrackingKeywordsInput,
  RemoveTrackingKeywordsResponse,
  GetRankTrackingRunInput,
  GetRankTrackingRunResponse,
  ListRankKeywordTagsInput,
  ListRankKeywordTagsResponse,
  ListRankTrackerConfigsInput,
  ListRankTrackerConfigsResponse,
  MutationSuccess,
  UpdateRankKeywordTagInput,
  UpdateRankKeywordTagResponse,
} from "../types.js";

/**
 * Rank tracking resource — read rank tracker configs/results and manage
 * tracker configs and their tracked keywords.
 */
export class RankTrackingResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all ACTIVE rank tracker configs for a project.
   * Free — reads from MisarSEO state, charges no credits.
   *
   * Rows come back verbatim from `rank_tracking_configs`, so `devices` is one
   * string (`"both" | "desktop" | "mobile"`), not an array. It was declared
   * `string[]`, which made `config.devices.map(...)` a TypeError and
   * `.includes("desktop")` a substring test that answers `false` for a tracker
   * checking desktop.
   */
  listConfigs(
    input: ListRankTrackerConfigsInput,
    options?: RequestOptions,
  ): Promise<ListRankTrackerConfigsResponse> {
    return this.http.get<ListRankTrackerConfigsResponse>(
      "/rank-tracking/configs",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * List one tracker's tracked keywords, a page at a time.
   * Free — reads from MisarSEO state, charges no credits.
   *
   * `configId` is REQUIRED. This method used to declare it optional and promise
   * that omitting it listed every tracker in the project; the route requires it
   * and answered 400, and the response it returns has never had a `configs`
   * field on it either. Use {@link listConfigs} for the tracker list.
   *
   * `page` and `pageSize` are coerced rather than rejected — an unparseable or
   * below-1 page means page 1, and `pageSize` is snapped DOWN to 50, 100 or 250.
   * The values actually applied come back on the response, so read
   * `result.page` / `result.pageSize` rather than assuming what was sent was
   * used, and compare `result.keywords.length` against `result.totalCount` to
   * know whether another page exists.
   */
  get(
    input: GetRankTrackerInput,
    options?: RequestOptions,
  ): Promise<GetRankTrackerResponse> {
    return this.http.get<GetRankTrackerResponse>(
      "/rank-tracking/keywords",
      {
        projectId: input.projectId,
        configId: input.configId,
        page: input.page,
        pageSize: input.pageSize,
      },
      options,
    );
  }

  /** Create a rank tracker config (domain + country + schedule). */
  create(
    input: CreateRankTrackerInput,
    options?: RequestOptions,
  ): Promise<CreateRankTrackerResponse> {
    return this.http.post<CreateRankTrackerResponse>(
      "/rank-tracking/configs",
      input,
      options,
    );
  }

  /** Update an existing rank tracker config. */
  update(
    input: UpdateRankTrackerInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.patch<MutationSuccess>(
      "/rank-tracking/configs",
      input,
      options,
    );
  }

  /** Delete a rank tracker config (cascades keywords, runs, snapshots). */
  delete(
    input: DeleteRankTrackerInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      "/rank-tracking/configs",
      input,
      options,
    );
  }

  /** Add keywords to a tracker config. */
  addKeywords(
    input: AddTrackingKeywordsInput,
    options?: RequestOptions,
  ): Promise<AddTrackingKeywordsResponse> {
    return this.http.post<AddTrackingKeywordsResponse>(
      "/rank-tracking/keywords",
      input,
      options,
    );
  }

  /** Remove keywords (by tracking-keyword ID) from a tracker config. */
  removeKeywords(
    input: RemoveTrackingKeywordsInput,
    options?: RequestOptions,
  ): Promise<RemoveTrackingKeywordsResponse> {
    return this.http.delete<RemoveTrackingKeywordsResponse>(
      "/rank-tracking/keywords",
      input,
      options,
    );
  }

  /**
   * Get the latest rank-check run (status, progress, staleness) for a
   * tracker config. `run` is `null` if the tracker has never run.
   * Free — reads from MisarSEO state, charges no credits.
   */
  getLatestRun(
    input: GetRankTrackingRunInput,
    options?: RequestOptions,
  ): Promise<GetRankTrackingRunResponse> {
    return this.http.get<GetRankTrackingRunResponse>(
      "/rank-tracking/runs",
      {
        projectId: input.projectId,
        configId: input.configId,
      },
      options,
    );
  }

  /**
   * List the tags in use on one tracker, plus the project's whole tag
   * vocabulary.
   * Free — reads from MisarSEO state, charges no credits.
   *
   * The two lists are separate on purpose: `tagsInUse` is what this tracker's
   * keywords actually carry (with a count of TRACKED keywords, not saved ones),
   * while `projectTags` is the full vocabulary, so a tag this tracker has not
   * used yet can still be assigned.
   */
  listKeywordTags(
    input: ListRankKeywordTagsInput,
    options?: RequestOptions,
  ): Promise<ListRankKeywordTagsResponse> {
    return this.http.get<ListRankKeywordTagsResponse>(
      "/rank-tracking/keyword-tags",
      {
        projectId: input.projectId,
        configId: input.configId,
      },
      options,
    );
  }

  /**
   * Attach or detach ONE tag across a selection of tracked keywords (up to 500
   * per call).
   * Free — charges no credits. Adding is idempotent, so it is safe to pass
   * `{ idempotent: true }` and let the SDK retry it like a GET.
   *
   * The tag is the project's existing saved-keyword tag: `{ tagName }` matches
   * on the shared normalized name and creates the tag when `action` is `"add"`.
   *
   * `changed` is `null` on an add — the idempotent insert cannot report how many
   * links were new without a second read. That is "not measured", not zero, and
   * it is not `trackingKeywordIds.length`; the keywords the tag was applied to
   * are counted separately as `keywordCount`.
   */
  updateKeywordTag(
    input: UpdateRankKeywordTagInput,
    options?: RequestOptions,
  ): Promise<UpdateRankKeywordTagResponse> {
    return this.http.post<UpdateRankKeywordTagResponse>(
      "/rank-tracking/keyword-tags",
      input,
      options,
    );
  }
}
