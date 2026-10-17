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
  GetRankConfigTrendInput,
  GetRankConfigTrendResponse,
  GetRankKeywordHistoryInput,
  GetRankKeywordHistoryResponse,
  GetRankMoversInput,
  GetRankMoversResponse,
  ListAnnotationsInput,
  ListAnnotationsResponse,
  AddAnnotationInput,
  AddAnnotationResponse,
  RemoveAnnotationInput,
  ListCannibalisationInput,
  ListCannibalisationResponse,
  SetKeywordTargetUrlInput,
  GetVolatilityIndexInput,
  GetVolatilityIndexResponse,
  GetAiOverviewTrendInput,
  GetAiOverviewTrendResponse,
  ListRankKeywordTagsInput,
  ListRankKeywordTagsResponse,
  ListRankTrackerConfigsInput,
  ListRankTrackerConfigsResponse,
  MutationSuccess,
  UpdateRankKeywordTagInput,
  UpdateRankKeywordTagResponse,
} from "../types.js";
import type {
  ListRankCompetitorsInput,
  ListRankCompetitorsResponse,
  RankCompetitorInput,
} from "../types-team.js";

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
   * Per-run keyword-position-distribution buckets for a tracker (GAP-103).
   * Free — reads from MisarSEO state, charges no credits.
   *
   * Buckets (`top3`, `top4to10`, `top11to20`, `notRanking`) are disjoint and
   * cover every tracked keyword. `device` is validated but on every free
   * SERP source today it narrows nothing — there is no device dimension, so
   * every reading folds to one series regardless of what is passed.
   */
  getConfigTrend(
    input: GetRankConfigTrendInput,
    options?: RequestOptions,
  ): Promise<GetRankConfigTrendResponse> {
    return this.http.get<GetRankConfigTrendResponse>(
      "/rank-tracking/trend",
      {
        projectId: input.projectId,
        configId: input.configId,
        device: input.device,
        sinceDays: input.sinceDays,
      },
      options,
    );
  }

  /**
   * Per-keyword position series for a tracker (GAP-104).
   * Free — reads from MisarSEO state, charges no credits.
   *
   * `position: null` means checked but not found within that check's
   * `searchedDepth` — a real event, not a missing check. At most one point
   * per UTC day: a same-day re-check collapses to its latest reading.
   */
  getKeywordHistory(
    input: GetRankKeywordHistoryInput,
    options?: RequestOptions,
  ): Promise<GetRankKeywordHistoryResponse> {
    return this.http.get<GetRankKeywordHistoryResponse>(
      "/rank-tracking/keyword-history",
      {
        projectId: input.projectId,
        configId: input.configId,
        trackingKeywordId: input.trackingKeywordId,
        sinceDays: input.sinceDays,
      },
      options,
    );
  }

  /**
   * Newcomers and fast climbers for a tracker's own domain, over a window
   * (GAP-108). Free — reads from MisarSEO state, charges no credits.
   *
   * NOT competitor discovery from an undeclared-domain corpus — no such
   * corpus exists (a rank check only ever persists the target domain and the
   * already-tracked competitor domains, never every domain seen in the
   * fetched SERP). `newlyRanking` compares the target domain's OWN positions
   * at the start and end of the window; `fastClimbers` is the same
   * comparison for a keyword that ranked at both ends and gained at least
   * `minGain` positions. `newlyRanking` entries always have `gain: null`.
   */
  getRankMovers(
    input: GetRankMoversInput,
    options?: RequestOptions,
  ): Promise<GetRankMoversResponse> {
    return this.http.get<GetRankMoversResponse>(
      "/rank-tracking/movers",
      {
        projectId: input.projectId,
        configId: input.configId,
        sinceDays: input.sinceDays,
        minGain: input.minGain,
      },
      options,
    );
  }

  /**
   * Chart notes (GAP-105) on a tracker's own timeline — "deployed new title
   * tags", "algorithm update". Free — reads from MisarSEO state, charges no
   * credits. Config-level, not per-keyword or per-device.
   */
  listAnnotations(
    input: ListAnnotationsInput,
    options?: RequestOptions,
  ): Promise<ListAnnotationsResponse> {
    return this.http.get<ListAnnotationsResponse>(
      "/rank-tracking/annotations",
      { projectId: input.projectId, configId: input.configId },
      options,
    );
  }

  /** Add a chart note. `date` is YYYY-MM-DD; `label` is 1-200 characters. */
  addAnnotation(
    input: AddAnnotationInput,
    options?: RequestOptions,
  ): Promise<AddAnnotationResponse> {
    return this.http.post<AddAnnotationResponse>(
      "/rank-tracking/annotations",
      input,
      options,
    );
  }

  /** Remove a chart note. Succeeds whether or not `id` matched one. */
  removeAnnotation(
    input: RemoveAnnotationInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      "/rank-tracking/annotations",
      input,
      options,
    );
  }

  /**
   * Self-cannibalisation findings (GAP-106): tracked keywords whose latest
   * ranking URL is not the declared `targetUrl`. Free — reads from MisarSEO
   * state, charges no credits.
   *
   * NOT the same detector as `gsc.cannibalisation()`, which finds two-or-more
   * of the site's OWN pages splitting Search Console impressions for one
   * query. A rank check records only the single best-ranking URL per keyword
   * per run, so this can only tell you the winning page was not the one you
   * intended — not that a second own page also showed up.
   */
  listCannibalisation(
    input: ListCannibalisationInput,
    options?: RequestOptions,
  ): Promise<ListCannibalisationResponse> {
    return this.http.get<ListCannibalisationResponse>(
      "/rank-tracking/cannibalisation",
      { projectId: input.projectId, configId: input.configId },
      options,
    );
  }

  /**
   * Set or clear a tracked keyword's intended target URL. `targetUrl` is
   * required — pass an absolute http(s) URL to set it, or `null` to clear a
   * previously-set one.
   */
  setKeywordTargetUrl(
    input: SetKeywordTargetUrlInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.post<MutationSuccess>(
      "/rank-tracking/keyword-target-url",
      input,
      options,
    );
  }

  /**
   * SERP volatility index (GAP-109) across the last `runLimit` completed
   * runs. Free — reads from MisarSEO state, charges no credits, and makes no
   * new SERP calls.
   *
   * Modeled on the one step AccuRanker publicly discloses for their Grump
   * Rating, CTR-weighted rather than a raw position delta. NOT a 0-10 Sensor
   * score or a mood label — Semrush and MozCast do not publish their
   * formulas, and both are calibrated against panels spanning the whole web.
   * `volatilityIndex` is meaningful only relative to THIS tracker's own
   * history over time.
   */
  getVolatilityIndex(
    input: GetVolatilityIndexInput,
    options?: RequestOptions,
  ): Promise<GetVolatilityIndexResponse> {
    return this.http.get<GetVolatilityIndexResponse>(
      "/rank-tracking/volatility",
      {
        projectId: input.projectId,
        configId: input.configId,
        device: input.device,
        runLimit: input.runLimit,
      },
      options,
    );
  }

  /**
   * AI Overview presence trend (GAP-147), oldest first — what share of a
   * tracker's keywords showed Google's AI Overview per check run, over the
   * window. Free — reads from MisarSEO state, charges no credits, and makes
   * no new SERP calls: reuses `rank_snapshots.serpFeatures`, already
   * populated by the rank checker's own SERP-feature capture.
   */
  getAiOverviewTrend(
    input: GetAiOverviewTrendInput,
    options?: RequestOptions,
  ): Promise<GetAiOverviewTrendResponse> {
    return this.http.get<GetAiOverviewTrendResponse>(
      "/rank-tracking/ai-overview-trend",
      {
        projectId: input.projectId,
        configId: input.configId,
        device: input.device,
        sinceDays: input.sinceDays,
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

  /**
   * Competitor domains tracked on one config, plus CTR-weighted share of
   * voice. Free — read from the SERPs rank checks already fetched.
   */
  listCompetitors(
    input: ListRankCompetitorsInput,
    options?: RequestOptions,
  ): Promise<ListRankCompetitorsResponse> {
    return this.http.get<ListRankCompetitorsResponse>(
      "/rank-tracking/competitors",
      {
        projectId: input.projectId,
        configId: input.configId,
        device: input.device,
      },
      options,
    );
  }

  /**
   * Start tracking one competitor domain (at most 10 per config). Idempotent:
   * re-adding a tracked domain answers 200 and writes nothing.
   */
  addCompetitor(
    input: RankCompetitorInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.post<MutationSuccess>(
      "/rank-tracking/competitors",
      input,
      options,
    );
  }

  /** Stop tracking one competitor domain. */
  removeCompetitor(
    input: RankCompetitorInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      "/rank-tracking/competitors",
      input,
      options,
    );
  }
}
