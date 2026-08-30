/* eslint-disable max-lines -- SDK type definitions are intentionally in a single file */
/**
 * MisarSEO TypeScript SDK — shared types.
 *
 * The REQUEST types are validated against the zod schema each route parses
 * (`tests/utils/sdkContract.ts`). The RESPONSE types are validated against the
 * service return type each route hands to `jsonOk`, at COMPILE time — see
 * `tests/unit/sdk/contracts/responses-*.test.ts`. Both guards exist because
 * these types were originally inferred from the in-app MCP tool definitions and
 * then pointed at REST routes that behave differently, which is how a published
 * response type ended up describing a payload no route produces (twice).
 */

// Imported as well as re-exported (`export *` further down): `Keyword` below
// references the name, and a re-export does not put it in local scope.
import type { KeywordMonthlySearch } from "./types-keyword-research.js";

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  rows: T[];
  totalCount: number;
  hasMore?: boolean;
  nextCursor?: string;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * A project row as every `/seo/projects*` route returns it — the four fields
 * `mapProject` (src/server/features/projects/services/projects.ts) emits, and
 * only those.
 *
 * `url` used to be declared here as an optional "Dashboard URL for this
 * project". No route has ever returned it: `mapProject` is the single shaping
 * function behind list/create/get/update and it emits `id`, `name`, `domain`
 * and `createdAt`. Because it was optional, reading `project.url` type-checked
 * and produced `undefined` on every project forever — a link that silently
 * never renders, with no error to explain it. `createdAt` is the mirror-image
 * defect: a field the server always sends that the SDK did not declare, so it
 * could not be read without an assertion.
 */
export interface Project {
  id: string;
  name: string;
  domain: string | null;
  /**
   * The IndexNow key this project's domain hosts at
   * `https://<domain>/<key>.txt`. Null when IndexNow submission is off for
   * this project. Not a secret — see `IndexNowResource`.
   */
  indexNowKey: string | null;
  /** ISO-8601. Always present — the column is NOT NULL with a `now()` default. */
  createdAt: string;
}

export interface ListProjectsResponse {
  projects: Project[];
}

export interface CreateProjectInput {
  name: string;
  domain?: string;
}

export interface GetProjectInput {
  projectId: string;
}

export interface ProjectResponse {
  project: Project;
}

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  /** Explicit `null` clears the domain; omit the key to leave it unchanged. */
  domain?: string | null;
  /**
   * The IndexNow key this project's domain hosts at
   * `https://<domain>/<key>.txt`. Explicit `null` turns IndexNow submission
   * off; omit the key to leave it unchanged. 8-128 letters/numbers/hyphens.
   */
  indexNowKey?: string | null;
}

export interface DeleteProjectInput {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

/**
 * One row of the SAVED-keyword list (`GET /keywords/saved`) — a
 * `saved_keywords` row joined to its cached metrics and its tags.
 *
 * This declared five fields (`keyword`, three metrics and an OPTIONAL `tags`)
 * out of the fourteen the route returns. Nothing broke loudly, which is why it
 * survived: the missing fields simply were not reachable. `id` was the
 * expensive one — it is the handle every saved-keyword mutation takes, so a
 * caller could list keywords and then had no typed way to act on one, and
 * `fetchedAt` and `competition` are sortable columns the request type has
 * always offered with nothing on the response to read them from.
 */
export interface Keyword {
  /** Handle for the saved-keyword mutations. */
  id: string;
  projectId: string;
  keyword: string;
  locationCode: number;
  languageCode: string;
  /** When the keyword was saved to the project. */
  createdAt: string;
  /**
   * Every metric below is null when nothing measured it. The row exists as soon
   * as the keyword is saved, so nulls here are the normal state for a keyword
   * whose metrics have not been fetched yet — not an error, and never 0.
   */
  searchVolume: number | null;
  cpc: number | null;
  /** 0–1 advertiser competition. */
  competition: number | null;
  /** 0–100. */
  keywordDifficulty: number | null;
  /**
   * Deliberately `string | null`, not the five-value intent union used on
   * `KeywordResearchRow`. This one is a raw Postgres text column: a row written
   * before any change to the vocabulary keeps whatever it was stored with, and
   * nothing re-validates it on the way out. Narrowing it would be a claim this
   * SDK is not in a position to make — the same reasoning as `AuditIssueType`
   * on a response.
   */
  intent: string | null;
  /** Volume history, oldest first. Empty when none was ever stored. */
  monthlySearches: KeywordMonthlySearch[];
  /** When the metrics were last refreshed; null when never measured. */
  fetchedAt: string | null;
  /** Always present — an empty array for an untagged keyword. */
  tags: KeywordTag[];
}

export interface KeywordTag {
  id: string;
  name: string;
  /** Case- and whitespace-folded form the uniqueness check keys on. */
  normalizedName: string;
  /** Palette key (e.g. "blue"). Null = derive a stable colour from the id. */
  color: string | null;
}

/**
 * A tag as it appears in `ListSavedKeywordsResponse.tags` — the project's whole
 * tag vocabulary, each with how many saved keywords carry it. `keywordCount` is
 * for the project, NOT for the page of rows returned alongside it.
 */
export interface KeywordTagSummary extends KeywordTag {
  keywordCount: number;
}

/**
 * NO REST ENDPOINT RETURNS THE FIVE TYPES BELOW, and none ever has.
 *
 * `KeywordResearchSeed`, `KeywordResearchRowOk`, `KeywordResearchRowError`,
 * `KeywordResearchResult` and `KeywordRow` describe the per-seed envelope of
 * the IN-APP MCP tool `research_keywords`, which fans out one service call per
 * seed and assembles `{ results: [...] }` in its own handler. They were what
 * the old — and wrong — `ResearchKeywordsResponse` claimed
 * `keywords.research()` resolved to; see `types-keyword-research.ts` for what
 * the route actually answers. They are kept exported because removing a
 * published type is a breaking change, not because a method returns one.
 */
export interface KeywordResearchSeed {
  seed: string;
  locationCode?: number;
  languageCode?: string;
}

/** See {@link KeywordResearchSeed}: no REST endpoint returns this. */
export interface KeywordResearchRowOk {
  seed: string;
  ok: true;
  rowCount: number;
  source: string;
  usedFallback: boolean;
  topRows: KeywordRow[];
}

/** See {@link KeywordResearchSeed}: no REST endpoint returns this. */
export interface KeywordResearchRowError {
  seed: string;
  ok: false;
  error: string;
}

/** See {@link KeywordResearchSeed}: no REST endpoint returns this. */
export type KeywordResearchResult =
  | KeywordResearchRowOk
  | KeywordResearchRowError;

/** See {@link KeywordResearchSeed}: no REST endpoint returns this. */
export interface KeywordRow {
  keyword: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  cpc?: number | null;
  competition?: number | null;
  intent?: string | null;
  [key: string]: unknown;
}

export interface ResearchKeywordsInput {
  projectId: string;
  /**
   * Seed keywords, 1-100 per call.
   *
   * This was `seeds: KeywordResearchSeed[]` with a per-seed market, which
   * `POST /seo/keywords/research` has never accepted — it reads `keywords` plus
   * ONE top-level market, so every SDK research call 400ed with
   * "keywords: must be a non-empty array". The mocks encoded `seeds`, so the
   * tests agreed with themselves.
   */
  keywords: string[];
  /** One market per request. Defaults to 2840 (US) / "en" server-side. */
  locationCode?: number;
  languageCode?: string;
  /** Bucketed server-side to 150 | 300 | 500. */
  resultLimit?: number;
  /**
   * Named `clickstream` on the wire. DOUBLES the credit cost of each seed;
   * defaults to false.
   */
  clickstream?: boolean;
}

// `ResearchKeywordsResponse` and the row/diagnostic types it is built from live
// in a sibling module. It used to be declared here as
// `{ results: KeywordResearchResult[] }` — a shape no route has ever returned;
// that module's header records what it was and where it came from.
export * from "./types-keyword-research.js";

/** Sortable columns on the saved-keyword list. */
export type SavedKeywordSortField =
  | "createdAt"
  | "keyword"
  | "searchVolume"
  | "cpc"
  | "competition"
  | "keywordDifficulty"
  | "fetchedAt";

/**
 * Query for `GET /keywords/saved`. Every name below is the name the route
 * reads.
 *
 * This was `tags` and `limit`. The route reads neither — it takes `tagNames`
 * and `pageSize` — so both were dropped and the request came back **200 with
 * an unfiltered first page**. A caller asking for "50 rows tagged Priority"
 * silently received 50 arbitrary rows and no error, which is worse than the
 * 400 the `seeds`/`url` mismatches produced: there was nothing to notice.
 *
 * The list filters below travel comma-separated, and an EMPTY array is sent as
 * nothing at all: the route refuses a parameter that is present but holds no
 * usable value (`?tagNames=` is a 400, not "no filter"), because silently
 * widening a result set is indistinguishable from a filter that legitimately
 * matched everything.
 */
export interface ListSavedKeywordsInput {
  projectId: string;
  /** Case-insensitive substring match on the keyword text. */
  search?: string;
  /** 1-based. Anything that parses below 1 becomes 1 server-side. */
  page?: number;
  /** Rounded DOWN server-side to 50, 100 or 250. Defaults to 50. */
  pageSize?: 50 | 100 | 250;
  /** Unrecognised values fall back to `createdAt` rather than failing. */
  sort?: SavedKeywordSortField;
  /** Unrecognised values fall back to `desc` rather than failing. */
  order?: "asc" | "desc";
  /** Keep rows carrying ANY of these tag names (max 50). */
  tagNames?: string[];
  /** Keep rows carrying ANY of these tag ids (max 50); unioned with `tagNames`. */
  tagIds?: string[];
  /** Keep rows whose keyword contains EVERY one of these terms (max 20). */
  includeTerms?: string[];
  /** Drop rows whose keyword contains ANY of these terms (max 20). */
  excludeTerms?: string[];
  minVolume?: number;
  maxVolume?: number;
  minCpc?: number;
  maxCpc?: number;
  /** 0–100. */
  minDifficulty?: number;
  /** 0–100. */
  maxDifficulty?: number;
}

export interface ListSavedKeywordsResponse {
  /** This page of saved keywords, ordered by `sort`/`order`. */
  rows: Keyword[];
  /** Rows matching the filters across the whole project, not on this page. */
  totalCount: number;
  /**
   * The project's whole tag vocabulary with usage counts — NOT just the tags
   * appearing on `rows`. It was typed `KeywordTag[]`, which dropped
   * `keywordCount` (and, before this sweep, `normalizedName` and `color` too),
   * so the one thing this list is for could not be read.
   */
  tags: KeywordTagSummary[];
}

/**
 * Body for `POST /keywords/saved`.
 *
 * `tagMode` used to be here and is gone. It exists on the WEB app's save
 * schema, but `restSaveKeywordsSchema` — the schema this route parses — has
 * never declared it, so it was stripped from every request: `tagMode:
 * "replace"` did nothing at all while reading as though tags had been
 * replaced. Removing it is deliberately not the same as making it work;
 * teaching the route to honour it would change what a live endpoint does to
 * stored data, which is a decision, not a fix.
 *
 * `metrics` is absent for the same reason and has never been offered here.
 */
export interface SaveKeywordsInput {
  projectId: string;
  keywords: string[];
  /** Appended to whatever these keywords already carry. No ceiling here. */
  tags?: string[];
  locationCode?: number;
  languageCode?: string;
}

export interface SaveKeywordsResponse {
  success: boolean;
  savedKeywordIds: string[];
}

export interface KeywordPotentialInput {
  projectId: string;
  keyword: string;
  /** DataForSEO location code. Omit to use the project's default market
   *  (2840, United States, for a project that has not set one). */
  locationCode?: number;
  /** Default "en". */
  languageCode?: string;
}

export interface KeywordPotential {
  /**
   * The keyword sending the most traffic to the page that currently wins the
   * seed, when that is a different keyword. Null when the seed is already the
   * parent.
   */
  parentTopic: string | null;
  parentTopicVolume: number | null;
  parentTopicPosition: number | null;
  /** Summed traffic estimate across every keyword the winning page ranks for. */
  trafficPotential: number | null;
  rankedKeywordCount: number;
  /** True when the result set hit the request limit, so the total is a floor. */
  truncated: boolean;
  /** The page the metrics describe, so they can be sanity-checked. */
  topRankingUrl: string;
  /** Always DataForSEO's ETV model — an estimate, never observed clicks. */
  provenance: "dataforseo-etv";
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Rank Tracking
// ---------------------------------------------------------------------------

/**
 * A `rank_tracking_configs` row, as `GET /seo/rank-tracking/configs` returns
 * each entry of `configs`.
 *
 * `devices` is ONE string, not a list — see the field note below.
 */
export interface RankTrackerConfig {
  id: string;
  domain: string;
  locationCode: number;
  /** `daily` | `weekly` | `manual`; `string` because it is a response field. */
  scheduleInterval: string;
  /**
   * `"both" | "desktop" | "mobile"` — a SINGLE value, and `"both"` is how two
   * devices are expressed.
   *
   * This was `string[]`. The column is one `text` field and the route returns
   * the row verbatim, so the value on the wire is the string `"both"`, never
   * `["desktop","mobile"]`. Typed as an array it invited exactly the code that
   * breaks on it: `config.devices.map(...)` is a TypeError, `.length` reads 4,
   * and `.includes("desktop")` answers `false` for a tracker that checks
   * desktop — a substring test dressed as a membership test, with no error to
   * say so. Left as `string` rather than the union for the usual response-side
   * reason: a stored row can predate a change to the vocabulary.
   */
  devices: string;
  serpDepth: number;
  [key: string]: unknown;
}

/**
 * NO REST ENDPOINT RETURNS THIS, and none ever has.
 *
 * `RankSnapshot`, `RankTrackingRun` and `RankTrackingResults` describe the
 * position-history payload of the app's own server function
 * (`getLatestResults`), which is not exposed over `api.misar.io/seo/*`. They
 * were what the old — and wrong — `GetRankTrackerResponse` claimed
 * `rankTracking.get()` resolved to. They are kept exported because removing a
 * published type is a breaking change, not because a method returns one.
 */
export interface RankSnapshot {
  keyword: string;
  desktop: {
    position: number | null;
    previousPosition: number | null;
  };
  mobile: {
    position: number | null;
    previousPosition: number | null;
  };
  [key: string]: unknown;
}

/** See {@link RankSnapshot}: no REST endpoint returns this. */
export interface RankTrackingRun {
  lastCheckedAt: string | null;
  [key: string]: unknown;
}

/** See {@link RankSnapshot}: no REST endpoint returns this. */
export interface RankTrackingResults {
  run: RankTrackingRun | null;
  rows: RankSnapshot[];
}

/**
 * Query for `GET /rank-tracking/keywords`.
 *
 * `configId` used to be optional here, documented as "if omitted, lists all
 * rank trackers in the project". It never did that: the route parses
 * `listTrackedKeywordsQuerySchema`, which requires `configId`, so omitting it
 * was a 400 rather than a project-wide listing. Use {@link
 * RankTrackingResource.listConfigs} for the list of trackers — that is the
 * endpoint which actually answers it.
 */
export interface GetRankTrackerInput {
  projectId: string;
  configId: string;
  /**
   * 1-based. Anything that does not parse to a number above 1 means page 1 —
   * the route coerces rather than rejecting.
   */
  page?: number;
  /**
   * Snapped DOWN to 50, 100 or 250 server-side; anything under 100 means 50.
   * The value actually applied comes back on the response.
   */
  pageSize?: 50 | 100 | 250;
}

/** One row of `GET /rank-tracking/keywords` — a `rank_tracking_keywords` row. */
export interface TrackedKeyword {
  id: string;
  configId: string;
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  metricsFetchedAt: string | null;
  createdAt: string;
  [key: string]: unknown;
}

/**
 * `GET /rank-tracking/keywords` response.
 *
 * This described `{ configs, config, results }` before — a shape the route has
 * never returned. The handler answers `{ keywords, totalCount, page, pageSize }`
 * and nothing else, so a caller reading `result.results.rows` got `undefined`
 * with no error to explain it.
 */
export interface GetRankTrackerResponse {
  keywords: TrackedKeyword[];
  /** Keywords on the whole config, not on this page. */
  totalCount: number;
  /** The page actually served, after the route's coercion. */
  page: number;
  /** The size actually applied, after the route snapped it down. */
  pageSize: number;
}

// Rank-tracker write types (create/update/delete configs + keyword mutations)
// live in a sibling module to keep this file under the lint line budget.
export * from "./types-rank-tracking.js";

// ---------------------------------------------------------------------------
// Domain Overview
// ---------------------------------------------------------------------------

export interface DomainOverviewInput {
  projectId: string;
  domain: string;
  includeSubdomains?: boolean;
  locationCode?: number;
  languageCode?: string;
}

/**
 * The overview itself — `DomainService.getOverview`'s result, which the route
 * nests under `overview` (see {@link DomainOverviewResponse}).
 *
 * `domain` was optional and five fields were missing entirely, hidden behind an
 * `[key: string]: unknown` index signature. The index signature is gone: it made
 * every undeclared field type as `unknown` instead of being absent, which is
 * precisely what let the missing envelope go unnoticed for as long as it did.
 */
export interface DomainOverview {
  /** The NORMALISED domain the figures describe, not the string requested. */
  domain: string;
  /**
   * Null in free mode — there is no honest free source for organic
   * traffic/keywords, so the field is explicitly "not measured" rather than 0.
   * Read `hasData` before presenting an empty overview as a weak domain.
   */
  organicTraffic: number | null;
  organicKeywords: number | null;
  /**
   * Always null today. `getOverview` hard-codes both: the backlink figures come
   * from a separate billable endpoint (`GET /seo/backlinks`) and are not folded
   * into this response. Declared because the route does send the keys.
   */
  backlinks: number | null;
  referringDomains: number | null;
  /** Domain authority 0–100. Null when the resolver could not place the domain. */
  authority: number | null;
  /** Global popularity rank (lower = stronger). Null with `authority`. */
  authorityGlobalRank: number | null;
  /**
   * Which provider produced `authority`, or null when there is no figure to
   * attribute. LABEL THE NUMBER WITH THIS: `tranco` is a popularity rank, not a
   * link-graph authority score, and rendering the two identically overstates it.
   *
   * A literal union rather than `string`, unlike the response enums that come
   * off stored rows: the value is computed in-process from a two-branch
   * resolver, and the cached form is re-validated against the same `z.enum` on
   * every read, so a value outside this set cannot reach the wire.
   */
  authoritySource: "openpagerank" | "tranco" | null;
  /**
   * False when nothing was measured at all. Distinct from every metric being
   * null by coincidence — a `hasData: false` overview is deliberately not
   * cached, so the next call retries rather than serving the blank for 12h.
   */
  hasData: boolean;
  /**
   * True when NOTHING here could be measured because no provider would answer —
   * not because the domain is small.
   *
   * READ THIS BEFORE `hasData`. A `hasData: false` overview has two causes that
   * this response deliberately keeps apart: a domain with a genuinely thin
   * organic footprint that is also outside Tranco's top million, and a provider
   * that could not be reached. Only the first is a finding about the domain.
   */
  unavailable?: boolean;
  /** Which upstream failed and why, when `unavailable` is true. */
  unavailableReason?: string | null;
  /**
   * Why `authority` is absent, when it is absent because the lookup FAILED
   * rather than because the domain is unranked. Null in the unranked case, which
   * is the honest and expected one.
   */
  authorityUnavailableReason?: string | null;
  fetchedAt: string;
}

/**
 * `GET /domain/overview` response.
 *
 * THE ENVELOPE IS REAL. The handler answers `jsonOk({ overview })`, and this
 * type used to be the inner object — so `domain.overview()` resolved to
 * `{ overview: {...} }` while its declared type promised the metrics at the top
 * level. Every field read was `undefined`: `result.organicTraffic` type-checked
 * as `number | null` and was neither, on a BILLED call, with a 200 and nothing
 * to indicate anything had gone wrong. The SDK's own test mocked a flat
 * `{ domain, hasData }` body, so it agreed with itself.
 */
export interface DomainOverviewResponse {
  overview: DomainOverview;
}

// ---------------------------------------------------------------------------
// Backlinks
// ---------------------------------------------------------------------------

/**
 * Query for `GET /backlinks`.
 *
 * `hideSpam` used to be here and is gone. The route reads `projectId`, `target`
 * and `scope` and nothing else — `backlinksOverviewInputSchema`, the shape the
 * published spec declares for this operation, has never carried a spam field —
 * so `hideSpam: false` was serialized into the query string, ignored, and
 * answered 200 with the service's own default filtering still applied. That is
 * the worst failure mode there is: the caller gets a filtered profile, believes
 * it is unfiltered, and has no error to tell them otherwise.
 *
 * Removing it is deliberately not the same as making it work. The overview
 * service takes no spam options at all (`BacklinksService.profileOverview` has
 * two parameters), so honouring it would mean changing what a live billable
 * endpoint returns — a decision, not a fix.
 */
export interface BacklinksInput {
  projectId: string;
  target: string;
  scope?: "domain" | "page";
}

export interface BacklinksSummary {
  backlinks: number | null;
  referringDomains: number | null;
  referringPages: number | null;
  rank: number | null;
  [key: string]: unknown;
}

export interface BacklinksOverview {
  overview: {
    summary: BacklinksSummary;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * One referring-domain row.
 *
 * NO METHOD ON THIS SDK RETURNS THIS TODAY — kept exported because removing a
 * published type is a breaking change (same reason as {@link RankSnapshot}).
 * `GET /seo/backlinks` serves the overview alone; the referring-domains page is
 * a separate service call (`profileReferringDomainsPage`) with no REST route in
 * front of it yet. If one is added, this is the row shape it should return.
 */
export interface ReferringDomain {
  domain: string | null;
  backlinks: number | null;
  [key: string]: unknown;
}

/**
 * `GET /seo/backlinks` response: the overview and nothing else.
 *
 * `referringDomains: { rows }` used to be declared here as a REQUIRED sibling of
 * `overview`. The handler answers `jsonOk({ overview })` and has never attached
 * a referring-domains list, so `profile.referringDomains.rows` threw
 * `TypeError: Cannot read properties of undefined` on the first call — after a
 * BILLED request, which is the worst place to discover it.
 *
 * The double nesting of `overview.overview` is real, not a typo: the service
 * returns `{ overview: … }` and the route wraps that again.
 */
export interface BacklinkProfile {
  overview: BacklinksOverview;
}

export type BacklinksAnchorsSortField =
  | "anchor"
  | "backlinks"
  | "referringDomains"
  | "referringPages"
  | "dofollow"
  | "firstSeen";

export interface BacklinksAnchorsInput {
  projectId: string;
  target: string;
  scope?: "domain" | "page";
  /** 1-based, default 1. */
  page?: number;
  /** Default 100. */
  pageSize?: 50 | 100 | 200;
  /** Default "backlinks". */
  sortField?: BacklinksAnchorsSortField;
  /** Default "desc". */
  sortOrder?: "asc" | "desc";
}

export interface AnchorRow {
  /** `""` is a real observation — an image link with no alt text. */
  anchor: string | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringPages: number | null;
  /** Count of dofollow links using this anchor, not a ratio. */
  dofollow: number | null;
  firstSeen: string | null;
}

export interface BacklinksAnchorsPage {
  rows: AnchorRow[];
  totalCount: number | null;
  hasMore: boolean;
  page: number;
  pageSize: number;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Google Search Console
// ---------------------------------------------------------------------------

export type GscDimension =
  | "query"
  | "page"
  | "country"
  | "device"
  | "date"
  | "searchAppearance";
export type GscSearchType =
  | "web"
  | "image"
  | "video"
  | "news"
  | "googleNews"
  | "discover";
export type GscDateRange =
  | "last_7_days"
  | "last_28_days"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "last_16_months";

export interface GscFilter {
  dimension: GscDimension;
  /**
   * Defaults to `equals`.
   *
   * These four are exactly `GSC_FILTER_OPERATORS`, which is what
   * `POST /seo/gsc/performance` validates against. The SDK also offered
   * `includingRegex` and `excludingRegex` — Search Console operators the route
   * has never accepted. That was worse than a 400: the route normalises an
   * unrecognised operator away and its schema default puts `equals` back, so
   * `{ dimension: "page", operator: "includingRegex", expression: "^/blog/" }`
   * returned 200 having asked Google for pages *equal to* the string
   * "^/blog/". The caller got an empty result set and no indication why.
   */
  operator?: "equals" | "notEquals" | "contains" | "notContains";
  expression: string;
}

export interface GscPerformanceInput {
  projectId: string;
  dimensions?: GscDimension[];
  dateRange?: GscDateRange;
  startDate?: string;
  endDate?: string;
  filters?: GscFilter[];
  rowLimit?: number;
  startRow?: number;
  type?: GscSearchType;
  dataState?: "all" | "final";
}

export interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  /** 0–1 fraction */
  ctr: number;
  /** 1-based average position */
  position: number;
  [key: string]: unknown;
}

/**
 * How far back MisarSEO's OWN retained history for the property reaches.
 *
 * Google's `searchAnalytics.query` serves ~16 months and nothing further; this
 * archive accumulates as a side effect of running date-grouped `performance()`
 * queries, so it commonly predates that floor. `null` means nothing has been
 * archived for the property yet (or the coverage read itself failed) — it is
 * "no history recorded", never "zero days of traffic".
 */
export interface GscArchiveCoverage {
  /** `YYYY-MM-DD`. */
  earliestDate: string;
  /** `YYYY-MM-DD`. */
  latestDate: string;
  /** Distinct archived days between the two bounds, not the span between them. */
  days: number;
}

export interface GscMetrics {
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  setupDocsUrl?: string;
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  rowCount?: number;
  rows?: GscRow[];
  /**
   * Present on every `ok: true` response and absent on the not-connected one,
   * so `undefined` and `null` are different facts here: `undefined` means the
   * question was never asked, `null` means it was asked and nothing has been
   * archived. The SDK omitted this field entirely, which made the property's
   * pre-16-month history invisible to every caller and left
   * `GET /gsc/archive` looking like it had nothing to read.
   */
  archive?: GscArchiveCoverage | null;
  hasMore?: boolean;
  nextStartRow?: number;
}

export interface GscArchiveInput {
  projectId: string;
  /**
   * `YYYY-MM-DD`. Required, and NOT clamped to Search Console's ~16-month
   * floor the way `GscPerformanceInput.startDate` is — see `gsc.archive()`.
   */
  startDate: string;
  /** `YYYY-MM-DD`, not before `startDate`. Required. */
  endDate: string;
}

/**
 * One archived day. Site-level totals only — the archive stores no per-query or
 * per-page breakdown, so there is no `keys` here as there is on `GscRow`.
 */
export interface GscArchiveRow {
  /** `YYYY-MM-DD` in Search Console's own reporting day. */
  date: string;
  clicks: number;
  impressions: number;
  /** 0–1 fraction */
  ctr: number;
  /** 1-based average position */
  position: number;
}

export interface GscArchiveResponse {
  /**
   * `false` means the project has no connected property, NOT that the archive
   * is empty — `reason` and `connectUrl` are then set and `rows` is absent. It
   * arrives with HTTP 200, so branch on this before reading anything else.
   */
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  /** The property the rows belong to, present only when `ok` is true. */
  siteUrl?: string;
  rowCount?: number;
  rows?: GscArchiveRow[];
}

export interface GscCoverageInput {
  projectId: string;
  /** Filter to one state, e.g. "Submitted and indexed". Free text, matching Google's own strings. */
  coverageState?: string;
  /** Page size, 1-1000. @default 200 */
  limit?: number;
  offset?: number;
}

/** How many tracked URLs sit in one index-coverage state. */
export interface GscCoverageSummaryEntry {
  coverageState: string | null;
  urls: number;
}

export interface GscCoverageUrl {
  url: string;
  coverageState: string | null;
  verdict: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  lastCrawlTime: string | null;
}

export interface GscCoverageResponse {
  /** `false` means the project has no connected property — see `GscArchiveResponse.ok`. */
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  siteUrl?: string;
  /** Headline counts per coverage state. */
  summary?: GscCoverageSummaryEntry[];
  rowCount?: number;
  /** One page of the URLs themselves, newest-inspected first. */
  rows?: GscCoverageUrl[];
}

export interface InspectUrlsInput {
  projectId: string;
  urls: string[];
  languageCode?: string;
}

export interface UrlInspectionResult {
  url: string;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface InspectUrlsResponse {
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  setupDocsUrl?: string;
  siteUrl?: string;
  results?: UrlInspectionResult[];
}

export interface GscConnectionStatusInput {
  projectId: string;
}

export interface GscConnectionInfo {
  siteUrl: string;
  connectedAccountEmail: string | null;
  connectedAt: string | null;
}

export interface GscConnectionStatusResponse {
  /** Whether the user has a Google OAuth grant at all */
  hasGrant: boolean;
  /** null if no property has been selected for this project */
  connection: GscConnectionInfo | null;
}

// Keyword-cannibalisation report types live in a sibling module to keep this
// file under the lint line budget (same pattern as types-competitors.ts).
export * from "./types-cannibalisation.js";

// ---------------------------------------------------------------------------
// AI Search (Brand Lookup / Prompt Explorer)
// ---------------------------------------------------------------------------

export type LlmPlatform = "chat_gpt" | "google";
export type PromptExplorerModel =
  | "chat_gpt"
  | "claude"
  | "gemini"
  | "perplexity";

export interface BrandLookupInput {
  projectId: string;
  /** No length limit on this route, unlike the app's own 250-character cap. */
  query: string;
  /**
   * AT MOST 5 (`BRAND_LOOKUP_MAX_COMPETITORS`). A sixth entry is a 400, not a
   * silent truncation, so the ceiling is stated here rather than left to be
   * discovered from a failed call.
   *
   * The cap is not cosmetic: the upstream cross-aggregated comparison accepts
   * 2–10 groups (the target plus nine) and throws outside that, and the throw is
   * absorbed — an over-cap request used to enqueue a scan that ran and a
   * share-of-voice comparison that silently came back empty.
   *
   * Empty entries are dropped BEFORE the count is checked, so six entries of
   * which one is `""` is a five-competitor request. Entries are stringified but
   * not trimmed.
   */
  competitors?: string[];
  /** Default 2840 (United States). A non-number falls back to the default. */
  locationCode?: number;
  /** Default "en". A non-string falls back to the default. */
  languageCode?: string;
}

export interface BrandPlatformBreakdown {
  platform: LlmPlatform;
  status: "success" | "error";
  mentions: number | null;
  aiSearchVolume: number | null;
}

export interface BrandShareOfVoiceEntry {
  label: string;
  isTarget: boolean;
  mentions: number | null;
  sharePct: number | null;
}

export interface BrandShareOfVoice {
  platforms: LlmPlatform[];
  entries: BrandShareOfVoiceEntry[];
}

export interface BrandTopPage {
  url: string;
  domain: string | null;
  platform: LlmPlatform;
  mentions: number | null;
  capturedVolume: number | null;
  keywords: Array<{ question: string; aiSearchVolume: number | null }>;
}

export interface BrandTopQuery {
  question: string;
  platform: LlmPlatform;
  aiSearchVolume: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  citedSources: Array<{
    url: string;
    domain: string | null;
    title: string | null;
  }>;
  brandsMentioned: string[];
}

export interface BrandMonthlyVolume {
  year: number;
  month: number;
  volume: number | null;
}

export interface BrandScanResult {
  query: string;
  detectedTargetType: "domain" | "keyword";
  resolvedTarget: string;
  fetchedAt: string;
  hasData: boolean;
  totalMentions: number | null;
  totalAiSearchVolume: number | null;
  perPlatform: BrandPlatformBreakdown[];
  shareOfVoice: BrandShareOfVoice | null;
  topPages: BrandTopPage[];
  topQueries: BrandTopQuery[];
  monthlyVolume: BrandMonthlyVolume[];
  /**
   * True when NO platform could be reached, so nothing in this result was
   * measured.
   *
   * `hasData: false` does not distinguish this from a brand the models simply do
   * not know — and only one of those is a finding. Check `unavailable` before
   * reporting a target as absent from AI answers.
   */
  unavailable?: boolean;
  /** Which upstream failed and why, when `unavailable` is true. */
  unavailableReason?: string | null;
}

/** Handle returned when a brand-lookup job is enqueued (async). */
export interface BrandLookupJob {
  jobId: string;
  lookupKey: string;
  status: "queued";
  statusUrl: string;
}

export interface BrandLookupStatusInput {
  projectId: string;
  jobId: string;
}

export type BrandLookupJobStatus =
  | "queued"
  | "running"
  | "complete"
  | "errored"
  | "unknown";

/** Response from polling a brand-lookup job's status. */
export interface BrandLookupStatusResponse {
  status: BrandLookupJobStatus;
  /** Present only when status === "complete". */
  result?: BrandScanResult;
  /** Present only when status === "errored". */
  error?: { message: string };
  /** Worker progress, present while queued/running. */
  progress?: unknown;
}

export interface PromptExplorerInput {
  projectId: string;
  /** No length limit on this route, unlike the app's own 500-character cap. */
  prompt: string;
  /**
   * 1–4 entries. The one field on this route that REFUSES an unrecognised
   * value: dropping a typo'd model would answer 200 with fewer answers than
   * were asked for and nothing to say why. Duplicates are deduped before the
   * fan-out but still count against the four-entry cap.
   */
  models: PromptExplorerModel[];
  highlightBrand?: string;
  /** Default true. */
  webSearch?: boolean;
  /**
   * Two-letter ISO country code, and deliberately NOT `WebSearchCountryCode`
   * here: the route accepts any string and treats an unrecognised one as "no
   * country preference" rather than an error, so typing this as the enum would
   * refuse at compile time what the endpoint answers 200 for.
   *
   * The consequence is that a code outside the supported set is silently
   * ignored. The set is the intersection of what all four models support:
   * US, GB, CA, AU, IE, DE, FR, ES, IT, NL, PT, PL, SE, NO, DK, BR, MX, IN,
   * JP, KR, SG, HK, TW, ZA.
   */
  webSearchCountryCode?: string;
}

export interface PromptExplorerCitation {
  url: string;
  domain: string | null;
  title: string | null;
  matchedBrand: boolean;
}

export type PromptResult =
  | {
      status: "success";
      model: PromptExplorerModel;
      modelName: string | null;
      text: string;
      citations: PromptExplorerCitation[];
      fanOutQueries: string[];
      brandMentioned: boolean | null;
      outputTokens: number | null;
      webSearch: boolean;
    }
  | {
      status: "error";
      model: PromptExplorerModel;
      errorCode: "UPSTREAM_ERROR";
      message: string;
    };

/** The explorer run itself — `explorePrompt`'s result, nested under `result`. */
export interface PromptExplorerResult {
  prompt: string;
  /** The brand citations were matched against, or null when none was given. */
  highlightBrand: string | null;
  fetchedAt: string;
  /**
   * One entry per DISTINCT requested model — duplicates are deduped before the
   * fan-out, so asking for `["claude","claude"]` yields one result, not two.
   * Narrow on `status` before reading anything else: a model that failed
   * carries `message`, not `text`.
   */
  results: PromptResult[];
}

/**
 * `POST /ai/prompt-explorer` response.
 *
 * THE ENVELOPE IS REAL — `jsonOk({ result })` — and `promptExplorer()` was
 * declared as the inner object, so `response.results` was `undefined` on every
 * call and the answers the caller had just paid four models for were one level
 * down, unreachable through the declared type. Same defect as
 * {@link DomainOverviewResponse}, on the more expensive endpoint of the two.
 */
export interface PromptExplorerResponse {
  result: PromptExplorerResult;
}

export interface BrandScanTrendInput {
  projectId: string;
  /** Brand or domain, matched case-insensitively. */
  target: string;
  /** Inclusive lower bound, `YYYY-MM-DD`. */
  since?: string;
}

export interface BrandScanTrendPoint {
  /** `YYYY-MM-DD`. */
  scannedOn: string;
  mentionCount: number | null;
  citedSourceCount: number | null;
  competitorCount: number | null;
}

export interface BrandScanTrendResponse {
  /** Oldest first. Empty until scans have actually run — never back-filled. */
  trend: BrandScanTrendPoint[];
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditStartInput {
  projectId: string;
  /**
   * The crawl's entry point. Named `startUrl` because that is what
   * `POST /seo/crawl/start` has always required — this field was `url` from the
   * SDK's first commit, so every `crawl.start()` call 400ed with
   * "startUrl is required". The mocks encoded `url`, so the tests passed.
   */
  startUrl: string;
  maxPages?: number;
}

/**
 * `POST /seo/crawl/start` answers `202` with exactly these two keys.
 *
 * It declared `{ auditId, projectId, status, url, startedAt }` before. The
 * handler returns `jsonOk({ jobId: auditId, auditId }, 202)` and never has
 * returned anything else, so four of those five fields were `undefined` on
 * every call and `jobId` — the one the sibling status/stream/comparison routes
 * take as their path segment — could not be read at all. Nothing 400ed, so
 * `response.status === "queued"` simply compared `undefined` and a poll loop
 * keyed on it never started.
 */
export interface AuditStartResponse {
  /**
   * The audit id under its other name. `auditId` doubles as the job id in the
   * current architecture, so these two are the SAME value on every response —
   * use either, but do not treat a difference between them as meaningful.
   */
  jobId: string;
  auditId: string;
}

export interface AuditStatusInput {
  projectId: string;
  auditId: string;
}

/**
 * The vocabulary `audits.status` is written with. There is no `queued`: a crawl
 * row is created already `running`, and the terminal success value is
 * `completed`, not `complete` — this union said `"queued" | "running" |
 * "complete" | "failed"`, so the two states a caller actually waits for were
 * both unmatchable.
 *
 * `AuditStatusDetail.status` below is nevertheless `string`, for the same
 * reason `AuditIssueType` response fields are: the column is plain `text` with
 * no CHECK constraint, so a stored row can predate a change to this list and
 * narrowing what the server *returns* would be a claim the SDK cannot make.
 */
export type AuditStatus = "running" | "completed" | "failed";

/**
 * Per-type issue counts.
 *
 * NO REST ENDPOINT RETURNS THIS, and none ever has — kept exported because
 * removing a published type is a breaking change (same reason as
 * {@link RankSnapshot}). It was `AuditSummary.issues`, which the status route
 * does not carry; `severity` was additionally `"critical" | "warning" |
 * "info"`, a vocabulary the audit issue engine has never used. Its real
 * severities are `error | warning | notice` — see
 * `ComparableIssue.severity`, which is reachable and does match.
 */
export interface AuditIssueSummary {
  type: string;
  /** `error` | `warning` | `notice` — see `IssueSeverity` in the issue engine. */
  severity: string;
  count: number;
  [key: string]: unknown;
}

/**
 * The audit progress record `GET /seo/crawl/{auditId}/status` reports, as
 * `AuditService.getStatus` shapes it.
 *
 * Every field name here differs from what the SDK used to claim: it described
 * `{ auditId, projectId, status, url, maxPages, pagesChecked, startedAt,
 * completedAt, issues }`, a shape no route has ever produced. The id is `id`,
 * the entry point is `startUrl`, progress is `pagesCrawled` / `pagesTotal`,
 * there is no `projectId`, no `maxPages` and no `issues` — so a caller reading
 * `summary.pagesChecked` to drive a progress bar got `undefined` with nothing
 * to explain it.
 */
export interface AuditStatusDetail {
  id: string;
  /** The crawl's entry point. */
  startUrl: string;
  /** See {@link AuditStatus} for the vocabulary; `string` on purpose. */
  status: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  /** e.g. "discovery"; null on rows written before phases were recorded. */
  currentPhase: string | null;
  startedAt: string;
  /** Null while the crawl is still running. */
  completedAt: string | null;
}

/**
 * `GET /seo/crawl/{auditId}/status` response.
 *
 * The payload is WRAPPED: the handler answers `jsonOk({ status })`, so the
 * progress record is one level down. The SDK declared the record's (wrong)
 * fields at the top level, which is the same defect `GetRankTrackerResponse`
 * carried — a 200 whose every field reads `undefined`.
 */
export interface AuditSummary {
  status: AuditStatusDetail;
}

// Audit-over-audit comparison and per-finding triage types live in a sibling
// module to keep this file under the lint line budget.
export * from "./types-audit-triage.js";

// Patches (GAP-025) types live in a sibling module, same reason.
export * from "./types-patches.js";

// Log File Analyzer / Bot Analytics types live in a sibling module, same
// reason.
export * from "./types-log-analyzer.js";

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

// SERP-competitor discovery types live in a sibling module to keep this file
// under the lint line budget (same pattern as types-rank-tracking.ts).
export * from "./types-competitors.js";

// Keyword-gap comparison (our domain vs. up to 3 competitors) — the inverse
// question to competitor discovery. Sibling module, same reason.
export * from "./types-keyword-gap.js";

// Link intersect (domains linking to our competitors but not to us) — the
// backlink counterpart of the keyword gap. Sibling module, same reason.
export * from "./types-link-intersect.js";

// ---------------------------------------------------------------------------
// Local SEO
// ---------------------------------------------------------------------------

export interface LocalSeoNear {
  latitude: number;
  longitude: number;
  /** Search radius around the center, in kilometers. */
  radiusKm: number;
}

export interface BusinessListingsInput {
  projectId: string;
  near: LocalSeoNear;
  /** Business name or title text to match. */
  query?: string;
  /** Business categories to filter by (1-10), e.g. "restaurant". */
  categories?: string[];
  /** Max rows to return (1-50). Defaults to 20. */
  limit?: number;
}

export interface LocalBusinessListing {
  title: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  isClaimed: boolean | null;
  /** Which provider answered this row — never fabricated when unavailable. */
  dataSource: "openstreetmap" | "dataforseo";
}

export interface BusinessListingsResponse {
  businesses: LocalBusinessListing[];
}

export interface QuestionsAnswersInput {
  projectId: string;
  /** Business name or search phrase identifying the listing. */
  keyword: string;
  near: LocalSeoNear;
  /** Max rows to fetch (1-100). Defaults to 20. */
  depth?: number;
  languageCode?: string;
}

export interface LocalQuestionAnswer {
  question: string | null;
  answer: string | null;
  /** Which provider answered this row — never fabricated when unavailable. */
  dataSource: "autocomplete_derived" | "dataforseo";
}

export interface QuestionsAnswersResponse {
  questions: LocalQuestionAnswer[];
}

export interface CrawlStreamInput {
  projectId: string;
  auditId: string;
}

/** One parsed frame from the `/crawl/:auditId/stream` Server-Sent Events feed. */
export interface CrawlStreamEvent {
  event: "progress" | "complete" | "error";
  data: unknown;
}

// ---------------------------------------------------------------------------
// Account (Data Subject Rights — export / delete)
// ---------------------------------------------------------------------------

/**
 * Full JSON export of the caller's own data (GDPR Art. 15/20, CCPA, DPDPA).
 *
 * `subject` carries no index signature, so the two fields added below were
 * unreadable rather than merely undocumented — and they are the two that say
 * what this export COVERS. A member (not owner/admin) receives an export with
 * `projects`, `keywords`, `rankTracking` and `audits` all empty because the
 * organization's shared business records were withheld, which is
 * indistinguishable from "the account has no data" unless
 * `includesOrganizationData` can be read.
 */
export interface AccountExport {
  exportedAt: string;
  schemaVersion: number;
  subject: {
    userId: string;
    organizationId: string;
    email: string | null;
    /**
     * `owner` | `admin` | `member` as resolved at export time, or `null` when
     * the caller holds no membership row in the organization at all.
     *
     * Both halves matter. `string` rather than a union because this is a
     * response field and the role vocabulary is not the SDK's to freeze; and
     * `| null` because `resolveOrgRole` genuinely returns null — that is the
     * state a caller must not read as "member".
     */
    organizationRole: string | null;
    /**
     * `false` means the organization-wide sections were withheld because the
     * caller is neither owner nor admin — NOT that they were empty. Read this
     * before concluding anything from an empty `projects` / `audits` block.
     */
    includesOrganizationData: boolean;
  };
  [key: string]: unknown;
}

export interface DeleteAccountInput {
  /** Required confirmation guard against accidental erasure — must be exactly "DELETE". */
  confirm: "DELETE";
}

/**
 * Erasure blast radius, which depends on membership and is reported, not
 * assumed.
 *
 * `deletedOrganizationId` was declared `string`. The server returns `null`
 * whenever teammates remain — only the caller's own rows are erased and the
 * organization survives — so a consumer typed to expect a string treated "the
 * org is still there" as an org id and would happily log or display it.
 * `organizationDeleted` is the boolean that states the same fact directly and
 * was missing entirely.
 */
export interface DeleteAccountResponse {
  success: true;
  deletedUserId: string;
  /** The torn-down organization's id, or `null` when the organization survived. */
  deletedOrganizationId: string | null;
  /** True only on the sole-member path, where the whole organization went. */
  organizationDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export interface ListActivityInput {
  /** Narrow to one project's history. */
  projectId?: string;
  /** 1–100, default 50. */
  pageSize?: number;
  /** Keyset cursor from the previous page's `nextCursor`. */
  before?: string;
}

export interface ActivityEntry {
  id: string;
  organizationId: string;
  /** Null for system actions (cron, scheduled crawls). */
  userId: string | null;
  /** Denormalised, so the log still reads after a user is erased. */
  userEmail: string | null;
  /** Stable machine key, e.g. "project.deleted". */
  action: string;
  targetType: string | null;
  targetId: string | null;
  projectId: string | null;
  /** Small JSON blob, carried as the raw string. */
  metadata: string | null;
  createdAt: string;
}

export interface ListActivityResponse {
  /** Newest first. */
  entries: ActivityEntry[];
  hasMore: boolean;
  /** Feed back as `before` for the next page. */
  nextCursor: string | null;
}

// ─── IndexNow ────────────────────────────────────────────────────────────

export interface IndexNowSubmitInput {
  projectId: string;
  /**
   * Absolute URLs to submit, all on the project's own domain (1-10000).
   * IndexNow rejects a mixed-host batch, and so does this endpoint.
   */
  urls: string[];
}

export type IndexNowSubmitResponse =
  | { ok: true; submitted: number }
  | { ok: false; reason: string; settingsUrl?: string };

// ─── Bing Webmaster ─────────────────────────────────────────────────────

export interface BingSiteOverviewInput {
  projectId: string;
}

export interface BingRankTrafficRow {
  /** ISO-8601, or null when Bing's date could not be parsed. */
  date: string | null;
  clicks: number;
  impressions: number;
}

export interface BingQueryStatsRow {
  query: string;
  date: string | null;
  clicks: number;
  impressions: number;
  avgClickPosition: number | null;
  avgImpressionPosition: number | null;
}

export interface BingLinkCount {
  url: string;
  count: number;
}

export interface BingSiteOverviewErrors {
  rankAndTraffic?: string;
  queryStats?: string;
  backlinks?: string;
  submissionQuota?: string;
}

export type BingSiteOverviewResponse =
  | {
      ok: true;
      siteUrl: string;
      /** Null, with the reason in `errors.rankAndTraffic`, when this one read failed. */
      rankAndTraffic: BingRankTrafficRow[] | null;
      queryStats: BingQueryStatsRow[] | null;
      /** Own-site inbound links only — Bing exposes no competitor lookup. */
      backlinks: { links: BingLinkCount[]; totalPages: number } | null;
      submissionQuota: { dailyQuota: number; monthlyQuota: number } | null;
      errors: BingSiteOverviewErrors;
    }
  | { ok: false; reason: string };

// ─── Yandex Webmaster ───────────────────────────────────────────────────

export interface YandexSiteOverviewInput {
  projectId: string;
  /** Max popular queries to return (1-500). @default the API's own default. */
  queryLimit?: number;
}

export interface YandexSiteSummary {
  /** Site Quality Index — a third independent authority signal alongside
   *  OpenPageRank and Tranco. Null when Yandex has not computed one yet. */
  sqi: number | null;
  searchablePagesCount: number | null;
  excludedPagesCount: number | null;
  /** Issue counts by severity, e.g. `{ FATAL: 1, RECOMMENDATION: 3 }`. */
  siteProblems: Record<string, number>;
}

export interface YandexPopularQueryRow {
  queryText: string;
  totalShows: number;
  totalClicks: number;
  avgShowPosition: number | null;
  avgClickPosition: number | null;
}

export interface YandexSiteOverviewErrors {
  summary?: string;
  popularQueries?: string;
}

export type YandexSiteOverviewResponse =
  | {
      ok: true;
      hostId: string;
      summary: YandexSiteSummary | null;
      popularQueries: YandexPopularQueryRow[] | null;
      errors: YandexSiteOverviewErrors;
    }
  | { ok: false; reason: string };
