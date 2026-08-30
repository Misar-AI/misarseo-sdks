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
  devices?: RankTrackerDevices;
  scheduleInterval?: RankTrackerSchedule;
  /** 3–100, or `null` for "alerting off". Omitted keeps the default (off). */
  rankDropAlertThreshold?: number | null;
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
  devices?: RankTrackerDevices;
  scheduleInterval?: RankTrackerSchedule;
  isActive?: boolean;
  /** 3–100, or `null` for "alerting off". Omitted leaves the stored value. */
  rankDropAlertThreshold?: number | null;
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
