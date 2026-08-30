/**
 * MisarSEO TypeScript SDK — audit comparison and triage types.
 * Split out of `types.ts` to keep that module under the lint line budget; these
 * interfaces describe the audit-over-audit diff, the issue mute rules, and the
 * per-finding status surface exposed by `resources/crawl.ts`.
 */

/**
 * Every rule the audit issue engine can report — the exact vocabulary of
 * `AUDIT_ISSUE_TYPES`, which is what the mute-rule and issue-status routes
 * validate an incoming `type` / `issueType` against.
 *
 * Stated as a union rather than `string` for the same reason
 * `DeleteAccountInput.confirm` is the literal `"DELETE"`: the routes reject
 * anything outside the list with a 400, and an input typed `string` promises a
 * caller their value is acceptable when the server has already decided it is
 * not. `IssueStatusValue` below was always modelled this way; these were not.
 *
 * Response fields keep `string` deliberately — a stored row can predate a
 * change to this list, and narrowing what the server *returns* would be a
 * claim this SDK is not in a position to make.
 */
export type AuditIssueType =
  | "broken_page"
  | "broken_internal_link"
  | "server_error"
  | "redirected_page"
  | "missing_title"
  | "duplicate_title"
  | "title_too_long"
  | "title_too_short"
  | "missing_meta_description"
  | "duplicate_meta_description"
  | "meta_description_too_long"
  | "missing_h1"
  | "multiple_h1"
  | "heading_order_skip"
  | "images_missing_alt"
  | "thin_content"
  | "duplicate_content"
  | "missing_canonical"
  | "canonical_to_broken_url"
  | "non_self_canonical"
  | "noindex_page"
  | "orphan_page"
  | "invalid_hreflang"
  | "slow_response"
  | "missing_structured_data"
  | "invalid_structured_data"
  | "ai_crawler_blocked"
  | "render_unavailable"
  | "llms_txt_not_found"
  | "llms_txt_invalid_format"
  | "non_secure_page"
  | "mixed_content"
  | "insecure_page_link"
  | "meta_refresh_tag"
  | "robots_txt_not_found"
  | "sitemap_not_found"
  | "sitemap_not_in_robots"
  | "sitemap_broken_url"
  | "url_underscore"
  | "url_too_many_parameters"
  | "url_too_long"
  | "no_viewport_tag"
  | "viewport_missing_width"
  | "no_doctype"
  | "no_charset_declared"
  | "uses_frames"
  | "incompatible_plugin_content"
  | "html_size_too_large"
  | "low_text_html_ratio"
  | "deep_click_depth"
  | "low_inbound_internal_links"
  | "too_many_page_links"
  | "malformed_internal_link"
  | "link_url_too_long"
  | "hreflang_conflict"
  | "hreflang_missing_self_reference"
  | "hreflang_relative_url"
  | "duplicate_h1_title"
  | "multiple_canonical_urls"
  | "invalid_breadcrumb_list"
  | "broken_external_link"
  | "broken_image"
  | "broken_js_or_css_resource";

export interface AuditComparisonInput {
  projectId: string;
  auditId: string;
  /** Omitted means "the run immediately before auditId". */
  baselineAuditId?: string;
}

export interface ComparableIssue {
  /** An audit issue type, e.g. "missing_title". */
  type: string;
  severity: "error" | "warning" | "notice";
  /** Null for a site-wide finding. */
  url: string | null;
  detail?: string | null;
}

export interface AuditComparison {
  auditId: string;
  baselineAuditId: string;
  healthScore: number | null;
  baselineHealthScore: number | null;
  /** Present now, absent before, on a page both crawls visited. */
  newIssues: ComparableIssue[];
  /** Present before, absent now, on a page both crawls visited. */
  fixedIssues: ComparableIssue[];
  /** Present in both — counted rather than listed. */
  persistingCount: number;
  /** Positive means the score improved. Null if either side lacks a score. */
  healthScoreDelta: number | null;
  addedUrlCount: number;
  droppedUrlCount: number;
  /**
   * Findings excluded from the diff because their page appears in only one of
   * the two crawls, so a small `fixedIssues` is never mistaken for a small
   * amount of change.
   */
  notComparableCount: number;
}

export interface ListIssueMuteRulesInput {
  projectId: string;
}

export interface IssueMuteRule {
  id: string;
  projectId: string;
  /** An audit issue type, e.g. "missing_title". */
  type: string;
  /** Glob against the page URL. `*` matches every page. */
  urlPattern: string;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ListIssueMuteRulesResponse {
  rules: IssueMuteRule[];
}

export interface CreateIssueMuteRuleInput {
  projectId: string;
  type: AuditIssueType;
  /** Glob against the page URL, defaults to `*` (every page). */
  urlPattern?: string;
  note?: string | null;
}

/**
 * `{ alreadyExists: true }` when the unique index absorbed a duplicate — the
 * 200 rather than 201 case. Nothing was created, but the rule is in place.
 */
export type CreateIssueMuteRuleResponse =
  | IssueMuteRule
  | { alreadyExists: true };

export interface DeleteIssueMuteRuleInput {
  projectId: string;
  ruleId: string;
}

export interface DeleteIssueMuteRuleResponse {
  deleted: true;
}

/** GAP-024 — re-ranks a finding's severity instead of muting it. */
export type AuditIssueSeverity = "error" | "warning" | "notice";

export interface ListIssueSeverityOverridesInput {
  projectId: string;
}

export interface IssueSeverityOverrideRule {
  id: string;
  projectId: string;
  /** An audit issue type, e.g. "missing_meta_description". */
  type: string;
  /** Glob against the page URL. `*` matches every page. */
  urlPattern: string;
  /** The severity reported instead of the check's own default. */
  severity: AuditIssueSeverity;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ListIssueSeverityOverridesResponse {
  rules: IssueSeverityOverrideRule[];
}

export interface CreateIssueSeverityOverrideInput {
  projectId: string;
  type: AuditIssueType;
  /** Glob against the page URL, defaults to `*` (every page). */
  urlPattern?: string;
  severity: AuditIssueSeverity;
  note?: string | null;
}

/**
 * `{ alreadyExists: true }` when the unique index absorbed a duplicate — the
 * 200 rather than 201 case. Nothing was created, but the rule is in place.
 */
export type CreateIssueSeverityOverrideResponse =
  | IssueSeverityOverrideRule
  | { alreadyExists: true };

export interface DeleteIssueSeverityOverrideInput {
  projectId: string;
  ruleId: string;
}

export interface DeleteIssueSeverityOverrideResponse {
  deleted: true;
}

/**
 * GAP-023 — a named, saved subset of a crawl: pages matching ANY of
 * `urlPatterns`. Nothing is re-crawled when a segment is applied; it re-scopes
 * an existing audit's results.
 */
export interface AuditSegment {
  id: string;
  projectId: string;
  name: string;
  /** Glob patterns against the page URL, ORed together. */
  urlPatterns: string[];
  createdByUserId: string | null;
  createdAt: string;
}

export interface ListAuditSegmentsInput {
  projectId: string;
}

export interface ListAuditSegmentsResponse {
  segments: AuditSegment[];
}

export interface CreateAuditSegmentInput {
  projectId: string;
  name: string;
  /** 1-10 glob patterns. */
  urlPatterns: string[];
}

/**
 * `{ alreadyExists: true }` when the unique (project, name) index absorbed a
 * duplicate name — the 200 rather than 201 case. Nothing was created.
 */
export type CreateAuditSegmentResponse = AuditSegment | { alreadyExists: true };

export interface DeleteAuditSegmentInput {
  projectId: string;
  segmentId: string;
}

export interface DeleteAuditSegmentResponse {
  deleted: true;
}

export interface GetSegmentedAuditResultsInput {
  projectId: string;
  auditId: string;
  segmentId: string;
}

export interface SegmentedIssue {
  type: string;
  severity: AuditIssueSeverity;
  url: string | null;
  detail: string | null;
}

export interface GetSegmentedAuditResultsResponse {
  segment: Pick<AuditSegment, "id" | "name" | "urlPatterns">;
  /** Null when the segment matched zero pages — same "not computed" rule the
   * audit's own health score follows. */
  healthScore: number | null;
  issueCounts: Record<AuditIssueSeverity, number>;
  matchedPageCount: number;
  /** How many pages the whole audit crawled, for context on coverage. */
  totalPageCount: number;
  /** Worst-first, capped — see `truncatedIssueCount` for how many were cut. */
  issues: SegmentedIssue[];
  truncatedIssueCount: number;
}

export type IssueStatusValue = "open" | "in_progress" | "fixed" | "wont_fix";

export interface ListIssueStatusesInput {
  projectId: string;
}

export interface IssueStatusEntry {
  /** `issueType` + " " + url — the url is an empty string when site-wide. */
  key: string;
  status: IssueStatusValue;
  note: string | null;
}

export interface ListIssueStatusesResponse {
  statuses: IssueStatusEntry[];
}

export interface SetIssueStatusInput {
  projectId: string;
  issueType: AuditIssueType;
  /** Null for a site-wide finding. */
  url?: string | null;
  status: IssueStatusValue;
  note?: string | null;
}

export interface IssueStatusRecord {
  id: string;
  projectId: string;
  issueType: string;
  /** Empty string for a site-wide finding. */
  url: string;
  status: IssueStatusValue;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface SetIssueStatusResponse {
  issueStatus: IssueStatusRecord | null;
}

export interface ClearIssueStatusInput {
  projectId: string;
  issueType: AuditIssueType;
  /** Null for a site-wide finding. */
  url?: string | null;
}

export interface ClearIssueStatusResponse {
  cleared: number;
}
