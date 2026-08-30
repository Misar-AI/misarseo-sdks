/**
 * @misar/seo — MisarSEO TypeScript SDK
 *
 * @example
 * ```typescript
 * import { MisarSeoClient } from "@misar/seo";
 *
 * const client = new MisarSeoClient({ apiKey: process.env.MISARSEO_API_KEY! });
 * const { projects } = await client.projects.list();
 * ```
 */

export { MisarSeoClient } from "./client.js";
export type { MisarSeoClientConfig } from "./client.js";

// Errors — every one extends MisarSeoError, so a single `instanceof
// MisarSeoError` still catches everything the SDK throws.
export {
  MisarSeoAbortError,
  MisarSeoAuthenticationError,
  MisarSeoConnectionError,
  MisarSeoError,
  MisarSeoNotFoundError,
  MisarSeoPaymentRequiredError,
  MisarSeoPermissionError,
  MisarSeoRateLimitError,
  MisarSeoTimeoutError,
  MisarSeoUpstreamError,
  MisarSeoValidationError,
} from "./error.js";

// Per-request options (timeout, cancellation, retry budget).
export type { RequestOptions } from "./http.js";

// Pagination primitives, for building iterators over endpoints the resource
// classes don't wrap yet.
export {
  iterateCursorPages,
  iterateOffsetPages,
  type CursorPage,
  type OffsetPage,
} from "./pagination.js";

// Resource classes (for typing purposes)
export { AccountResource } from "./resources/account.js";
export { ActivityResource } from "./resources/activity.js";
export { AiSearchResource } from "./resources/ai-search.js";
export { BacklinksResource } from "./resources/backlinks.js";
export { BingResource } from "./resources/bing.js";
export { CompetitorsResource } from "./resources/competitors.js";
export { CrawlResource } from "./resources/crawl.js";
export { DomainResource } from "./resources/domain.js";
export { GscResource } from "./resources/gsc.js";
export { IndexNowResource } from "./resources/indexnow.js";
export { KeywordsResource } from "./resources/keywords.js";
export { LocalResource } from "./resources/local.js";
export { ProjectsResource } from "./resources/projects.js";
export { RankTrackingResource } from "./resources/rank-tracking.js";
export { YandexResource } from "./resources/yandex.js";

// All types
export type {
  // Common
  PaginatedResponse,
  // Projects
  Project,
  ListProjectsResponse,
  CreateProjectInput,
  GetProjectInput,
  ProjectResponse,
  UpdateProjectInput,
  DeleteProjectInput,
  // Keywords
  Keyword,
  KeywordTag,
  KeywordTagSummary,
  KeywordMonthlySearch,
  // The five below describe the in-app MCP tool's per-seed envelope, which no
  // REST route returns. Still exported — see their note in types.ts.
  KeywordResearchSeed,
  KeywordResearchResult,
  KeywordResearchRowOk,
  KeywordResearchRowError,
  KeywordRow,
  ResearchKeywordsInput,
  // What `POST /keywords/research` actually answers.
  KeywordResearchSource,
  KeywordResearchMode,
  KeywordDifficultySource,
  KeywordResearchRow,
  KeywordResearchSourceAttempt,
  KeywordResearchDiagnostics,
  ResearchKeywordsResponse,
  ListSavedKeywordsInput,
  ListSavedKeywordsResponse,
  SaveKeywordsInput,
  SaveKeywordsResponse,
  KeywordPotentialInput,
  KeywordPotential,
  // Rank Tracking
  RankTrackerConfig,
  RankSnapshot,
  RankTrackingRun,
  RankTrackingResults,
  GetRankTrackerInput,
  GetRankTrackerResponse,
  TrackedKeyword,
  RankTrackerDevices,
  RankTrackerSchedule,
  CreateRankTrackerInput,
  CreateRankTrackerResponse,
  UpdateRankTrackerInput,
  DeleteRankTrackerInput,
  AddTrackingKeywordsInput,
  AddTrackingKeywordsResponse,
  RemoveTrackingKeywordsInput,
  RemoveTrackingKeywordsResponse,
  MutationSuccess,
  GetRankTrackingRunInput,
  RankCheckRunStatus,
  RankTrackingRunDetail,
  GetRankTrackingRunResponse,
  // Domain
  DomainOverviewInput,
  DomainOverview,
  DomainOverviewResponse,
  // Backlinks
  BacklinksInput,
  BacklinksSummary,
  BacklinksOverview,
  ReferringDomain,
  BacklinkProfile,
  BacklinksAnchorsSortField,
  BacklinksAnchorsInput,
  AnchorRow,
  BacklinksAnchorsPage,
  // Competitors
  SerpCompetitorResultType,
  SerpCompetitorsSortBy,
  FindSerpCompetitorsInput,
  SerpCompetitorRow,
  FindSerpCompetitorsResponse,
  // Keyword gap
  KeywordGapSortField,
  KeywordGapSortOrder,
  KeywordGapClassification,
  KeywordGapInput,
  KeywordGapCompetitorCell,
  KeywordGapRow,
  KeywordGapDomainCoverage,
  KeywordGapResult,
  // GSC
  GscDimension,
  GscSearchType,
  GscDateRange,
  GscFilter,
  GscPerformanceInput,
  GscRow,
  GscArchiveCoverage,
  GscMetrics,
  // `gsc.archive()` — the retained daily totals, read WITHOUT Search Console's
  // ~16-month clamp. Separate types from the `performance()` set on purpose:
  // both dates are required here, and a row carries no `keys` because the
  // archive is site-level only.
  GscArchiveInput,
  GscArchiveRow,
  GscArchiveResponse,
  // `gsc.coverage()` — MisarSEO's own index-coverage report, likewise read
  // WITHOUT calling Google: it reads `gscUrlCoverage`, filled in by a nightly
  // scan against the URL Inspection API's tight quota.
  GscCoverageInput,
  GscCoverageSummaryEntry,
  GscCoverageUrl,
  GscCoverageResponse,
  InspectUrlsInput,
  UrlInspectionResult,
  InspectUrlsResponse,
  GscConnectionStatusInput,
  GscConnectionInfo,
  GscConnectionStatusResponse,
  // GSC — keyword cannibalisation. The report is a discriminated union: narrow
  // on `state` before reading anything else.
  CannibalisationWindow,
  CannibalisationSort,
  CannibalisationInput,
  CannibalisationCompetingPage,
  CannibalisationFinding,
  CannibalisationThresholds,
  CannibalisationCoverage,
  CannibalisationNotConnected,
  CannibalisationRequiresReconnect,
  CannibalisationNoSearchData,
  CannibalisationAnalysed,
  CannibalisationReport,
  // AI Search
  LlmPlatform,
  PromptExplorerModel,
  BrandLookupInput,
  BrandPlatformBreakdown,
  BrandShareOfVoiceEntry,
  BrandShareOfVoice,
  BrandTopPage,
  BrandTopQuery,
  BrandMonthlyVolume,
  BrandScanResult,
  // `brandLookup()` and `brandLookupStatus()` resolve to these, and none of the
  // four was exported — a caller could call the methods but could not name what
  // they came back with.
  BrandLookupJob,
  BrandLookupStatusInput,
  BrandLookupJobStatus,
  BrandLookupStatusResponse,
  PromptExplorerInput,
  PromptExplorerCitation,
  PromptResult,
  PromptExplorerResult,
  PromptExplorerResponse,
  BrandScanTrendInput,
  BrandScanTrendPoint,
  BrandScanTrendResponse,
  // Audit
  AuditStartInput,
  AuditStartResponse,
  AuditStatusInput,
  AuditStatus,
  AuditIssueSummary,
  AuditStatusDetail,
  AuditSummary,
  AuditIssueType,
  AuditComparisonInput,
  ComparableIssue,
  AuditComparison,
  ListIssueMuteRulesInput,
  IssueMuteRule,
  ListIssueMuteRulesResponse,
  CreateIssueMuteRuleInput,
  CreateIssueMuteRuleResponse,
  DeleteIssueMuteRuleInput,
  DeleteIssueMuteRuleResponse,
  IssueStatusValue,
  ListIssueStatusesInput,
  IssueStatusEntry,
  ListIssueStatusesResponse,
  SetIssueStatusInput,
  IssueStatusRecord,
  SetIssueStatusResponse,
  ClearIssueStatusInput,
  ClearIssueStatusResponse,
  // Local SEO
  LocalSeoNear,
  BusinessListingsInput,
  LocalBusinessListing,
  BusinessListingsResponse,
  QuestionsAnswersInput,
  LocalQuestionAnswer,
  QuestionsAnswersResponse,
  CrawlStreamInput,
  CrawlStreamEvent,
  // Account
  AccountExport,
  DeleteAccountInput,
  DeleteAccountResponse,
  // Activity
  ListActivityInput,
  ActivityEntry,
  ListActivityResponse,
  // IndexNow
  IndexNowSubmitInput,
  IndexNowSubmitResponse,
  // Bing Webmaster
  BingSiteOverviewInput,
  BingRankTrafficRow,
  BingQueryStatsRow,
  BingLinkCount,
  BingSiteOverviewErrors,
  BingSiteOverviewResponse,
  // Yandex Webmaster
  YandexSiteOverviewInput,
  YandexSiteSummary,
  YandexPopularQueryRow,
  YandexSiteOverviewErrors,
  YandexSiteOverviewResponse,
} from "./types.js";
