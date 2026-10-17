/**
 * MisarSEO TypeScript SDK — rank-tracker write types.
 * Split out of `types.ts` to keep that module under the lint line budget; these
 * interfaces describe the create/update/delete config and keyword mutation
 * surface exposed by `resources/rank-tracking.ts`.
 */

export type RankTrackerDevices = "desktop" | "mobile" | "both";
export type RankTrackerSchedule = "daily" | "weekly" | "manual";

/**
 * `rankDropAlertThreshold` on both write inputs: notify when a keyword falls by
 * at least this many positions. `null` turns alerting off. The floor is 3 —
 * 1 or 2 would fire on ordinary SERP noise — and the ceiling is 100.
 *
 * It was missing from the SDK entirely while `createConfigSchema` /
 * `updateConfigSchema` have always accepted it, so rank-drop alerting could not
 * be configured through the SDK at all.
 */
export interface CreateRankTrackerInput {
  projectId: string;
  domain: string;
  /** SERP scan depth, 10–100 in steps of 10 */
  serpDepth: number;
  locationCode?: number;
  languageCode?: string;
  /**
   * GAP-102 — free-text city/region hint (a city name, or Google's own
   * "City,Region,Country" canonical format), honored ONLY when this
   * deployment's active SERP provider is openserp specifically. On any
   * other provider the value is stored but has no effect on where a check
   * runs from — it is never rejected, since it may become effective later
   * if the deployment switches providers.
   */
  locationHint?: string | null;
  devices?: RankTrackerDevices;
  scheduleInterval?: RankTrackerSchedule;
  /** 3–100, or `null` for "alerting off". Omitted keeps the default (off). */
  rankDropAlertThreshold?: number | null;
  /**
   * Notify when the target starts ranking for a keyword it wasn't before
   * (GAP-194). No magnitude to threshold — a plain on/off switch. Omitted
   * keeps the default (off).
   */
  newKeywordAlertEnabled?: boolean;
  /**
   * Notify when a tracked competitor gains at least this many positions, or
   * starts ranking for a keyword it wasn't before (GAP-194). Same floor/
   * ceiling as `rankDropAlertThreshold`. Omitted keeps the default (off).
   */
  competitorMoveAlertThreshold?: number | null;
}

export interface CreateRankTrackerResponse {
  configId: string;
}

export interface UpdateRankTrackerInput {
  projectId: string;
  configId: string;
  domain?: string;
  serpDepth?: number;
  locationCode?: number;
  languageCode?: string;
  /** GAP-102 — see {@link CreateRankTrackerInput.locationHint}. `null` clears
   *  a previously-set hint. */
  locationHint?: string | null;
  devices?: RankTrackerDevices;
  scheduleInterval?: RankTrackerSchedule;
  isActive?: boolean;
  /** 3–100, or `null` for "alerting off". Omitted leaves the stored value. */
  rankDropAlertThreshold?: number | null;
  /** See {@link CreateRankTrackerInput.newKeywordAlertEnabled}. Omitted
   *  leaves the stored value. */
  newKeywordAlertEnabled?: boolean;
  /** See {@link CreateRankTrackerInput.competitorMoveAlertThreshold}.
   *  Omitted leaves the stored value. */
  competitorMoveAlertThreshold?: number | null;
}

export interface DeleteRankTrackerInput {
  projectId: string;
  configId: string;
}

export interface AddTrackingKeywordsInput {
  projectId: string;
  configId: string;
  keywords: string[];
}

export interface AddTrackingKeywordsResponse {
  added: number;
  addedIds: string[];
  [key: string]: unknown;
}

export interface RemoveTrackingKeywordsInput {
  projectId: string;
  configId: string;
  keywordIds: string[];
}

export interface RemoveTrackingKeywordsResponse {
  removed: number;
}

export interface MutationSuccess {
  success: boolean;
}

export interface GetRankTrackingRunInput {
  projectId: string;
  configId: string;
}

export type RankCheckRunStatus = "pending" | "running" | "completed" | "failed";

export interface RankTrackingRunDetail {
  id: string;
  status: RankCheckRunStatus;
  keywordsTotal: number;
  keywordsChecked: number;
  isSubsetRun: boolean;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** True when the run looks stuck (DB says active, workflow instance disagrees). */
  maybeStale: boolean;
  staleReason: string | null;
  [key: string]: unknown;
}

export interface GetRankTrackingRunResponse {
  /** null when the tracker has never run */
  run: RankTrackingRunDetail | null;
}

export interface ListRankTrackerConfigsInput {
  projectId: string;
}

export interface ListRankTrackerConfigsResponse {
  /**
   * Active trackers only — the query filters on `is_active`, so a deactivated
   * tracker is absent rather than present with a flag.
   *
   * Rows are returned verbatim from `rank_tracking_configs`, which is why
   * `devices` is one string: see {@link RankTrackerConfig.devices} for what the
   * old `string[]` did to callers.
   */
  configs: Array<{
    id: string;
    domain: string;
    locationCode: number;
    /** `daily` | `weekly` | `manual`; `string` because it is a response field. */
    scheduleInterval: string;
    /** `"both" | "desktop" | "mobile"` — a SINGLE value, never an array. */
    devices: string;
    serpDepth: number;
    [key: string]: unknown;
  }>;
}

// ---------------------------------------------------------------------------
// Tracked-keyword tags
//
// The tags are the project's EXISTING saved-keyword tags — one vocabulary
// across saved keywords and rank tracking. Rank tracking adds only the join
// between them and tracked keywords.
// ---------------------------------------------------------------------------

export interface RankTrackingTag {
  id: string;
  name: string;
  /** Case- and whitespace-folded name; the key the "one vocabulary" rule uses. */
  normalizedName: string;
  /** Palette key (e.g. "sky"). Null = derive a stable color from the id. */
  color: string | null;
}

export interface RankTrackingTagInUse extends RankTrackingTag {
  /**
   * TRACKED keywords in this tracker carrying the tag — deliberately not the
   * saved-keyword count the same tag carries elsewhere, which would never match
   * the rows it filters to.
   */
  keywordCount: number;
}

export interface ListRankKeywordTagsInput {
  projectId: string;
  configId: string;
}

export interface ListRankKeywordTagsResponse {
  /** Tags this tracker's keywords actually carry. Empty until one is applied. */
  tagsInUse: RankTrackingTagInUse[];
  /** The project's whole tag vocabulary, including tags unused here. */
  projectTags: RankTrackingTag[];
}

/**
 * Which tag to act on: an existing one by id, or one by name.
 *
 * By name reuses the saved-keyword normalisation, so "Branded", "branded" and
 * " branded " are one tag. A name that does not exist yet is created on `add`
 * and rejected with a 404 on `remove` — there is nothing to detach.
 */
export type RankKeywordTagSelector = { tagId: string } | { tagName: string };

export interface UpdateRankKeywordTagInput {
  projectId: string;
  configId: string;
  action: "add" | "remove";
  tag: RankKeywordTagSelector;
  /** Tracking-keyword IDs, 1–500 per call. De-duplicated server-side. */
  trackingKeywordIds: string[];
}

export interface UpdateRankKeywordTagResponse {
  /** The resolved tag, including one created by name on `add`. */
  tag: RankTrackingTag;
  /** Tracking keywords the action was applied to, after de-duplication. */
  keywordCount: number;
  /**
   * Links actually changed, or `null` when that was not measured.
   *
   * `action: "add"` returns `null`: the insert is idempotent, so how many links
   * were new is not knowable without a second read. It is NOT the size of
   * `trackingKeywordIds` — do not substitute one for the other. `action:
   * "remove"` returns a real count, and both actions return `0` when none of
   * the submitted ids belong to the tracker.
   */
  changed: number | null;
}

// ---------------------------------------------------------------------------
// Trend & history (GAP-103, GAP-104)
// ---------------------------------------------------------------------------

export interface GetRankConfigTrendInput {
  projectId: string;
  configId: string;
  /** Any value other than "desktop"/"mobile" falls back to unset (read as
   *  "desktop"). On every free SERP source today this narrows nothing — see
   *  {@link RankConfigTrendResponse}. */
  device?: "desktop" | "mobile";
  /** 1-730, default 365. Unparseable or out of range falls back to the default. */
  sinceDays?: number;
}

export interface RankConfigTrendPoint {
  runId: string;
  checkedAt: string;
  /** Disjoint buckets covering every tracked keyword — `notRanking` is the
   *  remainder, not fetched separately. */
  top3: number;
  top4to10: number;
  top11to20: number;
  notRanking: number;
}

export interface GetRankConfigTrendResponse {
  trend: RankConfigTrendPoint[];
}

export interface GetRankKeywordHistoryInput {
  projectId: string;
  configId: string;
  trackingKeywordId: string;
  /** 1-730, default 365. Unparseable or out of range falls back to the default. */
  sinceDays?: number;
}

export interface RankKeywordHistoryPoint {
  device: "desktop" | "mobile";
  checkedAt: string;
  /** `null` = checked but not found within that check's `searchedDepth` — a
   *  real event, not a missing check. */
  position: number | null;
  /** `null` = the run predates this column, not that no depth was searched. */
  searchedDepth: number | null;
}

export interface GetRankKeywordHistoryResponse {
  /** At most one point per UTC day — a same-day re-check collapses to its
   *  latest reading. */
  history: RankKeywordHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Newcomers / fast climbers (GAP-108)
// ---------------------------------------------------------------------------

export interface GetRankMoversInput {
  projectId: string;
  configId: string;
  /** 1-730, default 365. Unparseable or out of range falls back to the default. */
  sinceDays?: number;
  /** Positions gained to count as a "fast climber", 1-100, default 5.
   *  Unparseable or out of range falls back to the default. Does not affect
   *  `newlyRanking`, which has no gain to threshold. */
  minGain?: number;
}

export interface RankMover {
  trackingKeywordId: string;
  keyword: string;
  device: "desktop" | "mobile";
  /** `null` on a keyword with no earlier reading at all, OR one whose
   *  earlier reading was itself `null` (not ranking) — both are "no prior
   *  position", not the same fact as "position 0". */
  previousPosition: number | null;
  currentPosition: number;
  /** Positions gained. `null` on a newly-ranking entry — there is no prior
   *  position to measure a gain from. */
  gain: number | null;
  isNewlyRanking: boolean;
}

export interface GetRankMoversResponse {
  /**
   * NOT competitor discovery from an undeclared-domain corpus — no such
   * corpus exists in this codebase (a rank check only ever persists the
   * target domain and the already-tracked competitor domains). This compares
   * the target domain's OWN positions at the start and end of the window.
   */
  newlyRanking: RankMover[];
  fastClimbers: RankMover[];
}

// ---------------------------------------------------------------------------
// Chart annotations (GAP-105)
// ---------------------------------------------------------------------------

export interface RankTrackingAnnotation {
  id: string;
  configId: string;
  /** UTC day (YYYY-MM-DD) the note applies to. */
  date: string;
  label: string;
  createdAt: string;
}

export interface ListAnnotationsInput {
  projectId: string;
  configId: string;
}

export interface ListAnnotationsResponse {
  /** Config-level notes, oldest first — not per-keyword or per-device. */
  annotations: RankTrackingAnnotation[];
}

export interface AddAnnotationInput {
  projectId: string;
  configId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** 1-200 characters. */
  label: string;
}

export interface AddAnnotationResponse {
  id: string;
}

export interface RemoveAnnotationInput {
  projectId: string;
  configId: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Target URL & self-cannibalisation (GAP-106)
// ---------------------------------------------------------------------------

export interface ListCannibalisationInput {
  projectId: string;
  configId: string;
}

export interface RankCannibalisationFinding {
  trackingKeywordId: string;
  keyword: string;
  /** The URL the user declared they intend to rank for this keyword. */
  targetUrl: string;
  /** The URL that actually ranked in the latest check — always on the
   *  tracked domain, just not the intended page. */
  rankingUrl: string;
  device: "desktop" | "mobile";
  /** Null when checked but not found within that check's searched depth. */
  position: number | null;
}

export interface ListCannibalisationResponse {
  /**
   * Keywords whose latest ranking URL is not the declared `targetUrl`. NOT
   * the same detector as GSC cannibalisation (`gsc.cannibalisation()`),
   * which finds two-or-more own pages splitting impressions for one query —
   * a rank check only ever records the single best-ranking URL per keyword
   * per run, so this can only tell you the winning page was not the
   * intended one.
   */
  findings: RankCannibalisationFinding[];
}

export interface SetKeywordTargetUrlInput {
  projectId: string;
  configId: string;
  trackingKeywordId: string;
  /** An absolute http(s) URL to set it, or `null` to clear a previously-set
   *  one. Required — there is no partial-update form of this call. */
  targetUrl: string | null;
}

// ---------------------------------------------------------------------------
// SERP volatility index (GAP-109)
// ---------------------------------------------------------------------------

export interface GetVolatilityIndexInput {
  projectId: string;
  configId: string;
  device?: "desktop" | "mobile";
  /** How many recent completed runs to compare consecutively, 2-26, default 12. */
  runLimit?: number;
}

export interface VolatilityPoint {
  runId: string;
  checkedAt: string;
  /**
   * Modeled on AccuRanker's disclosed Grump Rating step (sum of per-keyword
   * differences / number of results), CTR-weighted rather than a raw position
   * delta. NOT a 0-10 Sensor score or a mood label — meaningful only relative
   * to THIS tracker's own history over time, not as an absolute severity.
   */
  volatilityIndex: number;
  /** Keywords with a reading in either of the two compared runs. */
  keywordsCompared: number;
}

export interface GetVolatilityIndexResponse {
  /** Oldest first. One point per run after the first — there is no prior run
   *  to compare the first one in the window against. */
  points: VolatilityPoint[];
}

// ---------------------------------------------------------------------------
// AI Overview presence trend (GAP-147)
// ---------------------------------------------------------------------------

export interface GetAiOverviewTrendInput {
  projectId: string;
  configId: string;
  device?: "desktop" | "mobile";
  /** How many days back to look, 1-730, default 365. */
  sinceDays?: number;
}

export interface AiOverviewTrendPoint {
  runId: string;
  checkedAt: string;
  keywordsTotal: number;
  keywordsWithAiOverview: number;
  /**
   * `keywordsWithAiOverview / keywordsTotal * 100`, rounded to one decimal.
   * `null` — not 0 — when `keywordsTotal` is 0: nothing was checked that run,
   * which is a missing measurement, not a truthful "0% presence".
   */
  aiOverviewPresenceRatePct: number | null;
}

export interface GetAiOverviewTrendResponse {
  /** Oldest first, one point per completed run in the window. */
  points: AiOverviewTrendPoint[];
}
