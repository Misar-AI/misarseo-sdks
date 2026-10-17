// On-page metrics for one arbitrary URL (GAP-196), split into its own module
// for the same reason types-content-optimizer.ts is.
//
// Mirrors src/types/schemas/pageMetrics.ts.

export interface PageMetricsInput {
  projectId: string;
  /** The page to analyze. Any http(s) URL. */
  url: string;
}

export interface PageMetricsUnreachable {
  state: "unreachable";
  url: string;
  reason: string;
}

export interface PageMetricsAnalysed {
  state: "analysed";
  url: string;
  statusCode: number;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1Count: number;
  h1Text: string[];
  h2Count: number;
  h3Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  hasStructuredData: boolean;
  canonical: string | null;
  fetchedAt: string;
}

/**
 * Two mutually exclusive outcomes. `unreachable` means the page itself could
 * not be fetched — an ordinary outcome for an arbitrary URL check, not a
 * fault — narrow on `state` before reading anything else.
 */
export type PageMetricsResult = PageMetricsUnreachable | PageMetricsAnalysed;
