// Internal Link Report (GAP-071), Structured Data Report (GAP-066) and HTTPS
// Report (GAP-065/GAP-010 remainder) types, split out to keep types.ts under
// the lint line budget (same pattern as types-audit-triage.ts /
// types-gsc-insights.ts).
//
// Mirrors src/types/schemas/audit-internal-links.ts,
// src/types/schemas/audit-structured-data.ts and
// src/types/schemas/audit-https.ts. INTERNAL LINKS ONLY for the Internal
// Link Report — external links are explicitly out of scope; see
// CrawlResource's own docs for why.

export interface InternalLinkReportInput {
  projectId: string;
  /** Omitted means "the latest completed audit for this project". */
  auditId?: string;
}

export interface InternalLinkRun {
  auditId: string;
  startUrl: string;
  startedAt: string;
  completedAt: string | null;
  pagesCrawled: number;
}

export interface InternalLinkCoverage {
  pagesInAudit: number;
  pagesMeasured: number;
  pagesExcludedNotLoaded: number;
  pagesExcludedRenderFailed: number;
  pagesWithLinkMetrics: number;
  renderJsRequested: boolean;
  truncated: boolean;
  mutedInputTypes: string[];
}

export interface InternalLinkBucket {
  label: string;
  minInclusive: number;
  maxInclusive: number | null;
  pages: number;
}

export interface OutboundLinkRow {
  url: string;
  title: string | null;
  internalLinks: number;
  externalLinks: number;
}

export interface InboundLinkRow {
  url: string;
  title: string | null;
  inboundInternalLinks: number;
  clickDepth: number | null;
  internalLinks: number;
}

export interface ClickDepthBand {
  depth: number;
  pages: number;
}

export type InternalLinkWithheldReason =
  | "issue_engine_not_run"
  | "link_graph_incomplete"
  | "link_metrics_not_recorded";

export type ClickDepthSection =
  | { state: "withheld"; reason: InternalLinkWithheldReason }
  | { state: "no_entry_point"; startUrl: string }
  | {
      state: "measured";
      bands: ClickDepthBand[];
      deepest: number;
      unreachable: number;
    };

export interface BrokenLinkSourceRow {
  url: string;
  brokenLinks: number;
  samples: string[];
}

export interface OrphanPageRow {
  url: string;
  title: string | null;
  internalLinks: number | null;
}

export type InternalLinkSection<TRow> =
  | { state: "withheld"; reason: InternalLinkWithheldReason }
  | { state: "measured"; rows: TRow[]; total: number };

export interface InternalLinkTotals {
  internalLinkOccurrences: number;
  /** Raw per-page outbound tally — NOT an external link graph. This codebase
   *  does not compute one; see GAP-081's own wont-fix decision. */
  externalLinkOccurrences: number;
  averageInternalLinksPerPage: number | null;
  medianInternalLinksPerPage: number | null;
  averageInboundLinksPerPage: number | null;
  medianInboundLinksPerPage: number | null;
}

export interface InternalLinkGap {
  metric: string;
  reason: string;
}

/**
 * INTERNAL LINKS ONLY — narrow on `state` first, same discipline as every
 * other GSC/audit report in this SDK. `no_audit` and `signal_not_captured`
 * are both absences of measurement, never a clean bill of health.
 */
export type InternalLinkReport =
  | { state: "no_audit" }
  | {
      state: "signal_not_captured";
      run: InternalLinkRun;
      runs: InternalLinkRun[];
      reason: "no_pages_recorded" | "all_pages_excluded";
      coverage: InternalLinkCoverage;
      notDerivable: readonly InternalLinkGap[];
    }
  | {
      state: "analysed";
      run: InternalLinkRun;
      runs: InternalLinkRun[];
      coverage: InternalLinkCoverage;
      totals: InternalLinkTotals;
      distribution: InternalLinkBucket[];
      deadEnds: { rows: OutboundLinkRow[]; total: number };
      topOutbound: { rows: OutboundLinkRow[]; total: number };
      orphans: InternalLinkSection<OrphanPageRow>;
      brokenLinkSources: InternalLinkSection<BrokenLinkSourceRow>;
      strongestTargets: InternalLinkSection<InboundLinkRow>;
      thinlyLinked: InternalLinkSection<InboundLinkRow>;
      clickDepth: ClickDepthSection;
      notDerivable: readonly InternalLinkGap[];
    };

// ─── Structured Data Report (GAP-066) ──────────────────────────────────────

export interface StructuredDataReportInput {
  projectId: string;
  /** Omitted means "the latest completed audit for this project". */
  auditId?: string;
}

export interface StructuredDataRun {
  auditId: string;
  startUrl: string;
  startedAt: string;
  completedAt: string | null;
  pagesCrawled: number;
}

export interface StructuredDataPageRow {
  url: string;
  title: string | null;
  /** True when at least one JSON-LD block on this page failed to parse — a
   *  page-level fact, never attributable to one type when the page declares
   *  several. */
  hasParseError: boolean;
}

export interface StructuredDataTypeGroup {
  type: string;
  rows: StructuredDataPageRow[];
  total: number;
  /** Only present for `type === "BreadcrumbList"` — the one type with a
   *  real, GAP-020-verified per-type validity check. Every other type
   *  reports presence and page-level parse validity only, never a
   *  fabricated Rich-Results-eligibility verdict. */
  invalidCount?: number;
}

export interface StructuredDataTotals {
  pagesInAudit: number;
  pagesWithStructuredData: number;
  pagesWithoutStructuredData: number;
  pagesWithParseErrors: number;
  distinctTypes: number;
}

export interface StructuredDataGap {
  metric: string;
  reason: string;
}

/**
 * Two mutually exclusive outcomes — narrow on `state` first. `typeGroups: []`
 * on an `analysed` report means every page was measured and none declared
 * any structured data — a real finding, not a withheld section.
 */
export type StructuredDataReport =
  | { state: "no_audit" }
  | {
      state: "analysed";
      run: StructuredDataRun;
      runs: StructuredDataRun[];
      totals: StructuredDataTotals;
      typeGroups: StructuredDataTypeGroup[];
      noStructuredData: { rows: StructuredDataPageRow[]; total: number };
      parseErrors: { rows: StructuredDataPageRow[]; total: number };
      notDerivable: readonly StructuredDataGap[];
    };

// ─── HTTPS Report (GAP-065 + GAP-010 remainder) ────────────────────────────

export interface HttpsReportInput {
  projectId: string;
  /** Omitted means "the latest completed audit for this project". */
  auditId?: string;
}

export interface HttpsRun {
  auditId: string;
  startUrl: string;
  startedAt: string;
  completedAt: string | null;
  pagesCrawled: number;
}

export interface HttpsPageRow {
  url: string;
  detail: string | null;
}

export interface HttpsTotals {
  pagesInAudit: number;
  securePages: number;
  insecurePages: number;
  /** Null when the crawl reached no pages — not a 0% secure site. */
  securePagesPct: number | null;
  mixedContentPageCount: number;
  insecureLinkPageCount: number;
}

export interface HttpsHomepageStatus {
  hasHttpsPath: boolean;
  /** Null (not measured), never assumed healthy, unless the standalone
   *  homepage-HTTPS fetch observed a failure — see `CrawlResource.httpsReport`'s
   *  own docs for why the report cannot distinguish "checked and fine" from
   *  "never checked" any other way. */
  redirectsToHttps: boolean | null;
}

export interface HttpsGap {
  metric: string;
  reason: string;
}

/**
 * Two mutually exclusive outcomes — narrow on `state` first.
 */
export type HttpsReport =
  | { state: "no_audit" }
  | {
      state: "analysed";
      run: HttpsRun;
      runs: HttpsRun[];
      totals: HttpsTotals;
      homepageStatus: HttpsHomepageStatus;
      insecurePages: { rows: HttpsPageRow[]; total: number };
      mixedContentPages: { rows: HttpsPageRow[]; total: number };
      insecureLinkPages: { rows: HttpsPageRow[]; total: number };
      sitemapHttpUrls: { rows: HttpsPageRow[]; total: number };
      notDerivable: readonly HttpsGap[];
    };
