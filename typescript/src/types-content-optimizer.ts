// On-Page Content Optimizer + AI Content Grader types (GAP-134 / GAP-137(a)),
// split into their own module for the same reason types-cannibalisation.ts is.
//
// Mirrors src/types/schemas/contentOptimizer.ts.

export interface ContentOptimizerInput {
  projectId: string;
  /** The page to grade. Any http(s) URL. */
  url: string;
  /** The keyword this page is meant to rank for. */
  keyword: string;
  locationCode?: number;
  languageCode?: string;
}

/** One page's on-page signals — measured, not judged. */
export interface PageContentMetrics {
  url: string;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  wordCount: number;
  /** Flesch Reading Ease. Null when the page has no extractable body text. */
  readabilityScore: number | null;
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInMetaDescription: boolean;
  /** Case-insensitive literal substring count — not stemmed or
   *  synonym-aware. */
  keywordOccurrencesInBody: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  hasStructuredData: boolean;
}

export interface CompetitorPageMetrics extends PageContentMetrics {
  domain: string;
  /** 1-based organic SERP position for the target keyword. */
  serpRank: number;
}

export type ContentOptimizerGrade = "A" | "B" | "C" | "D" | "F";
export type RecommendationPriority = "high" | "medium" | "low";

export interface ContentOptimizerRecommendation {
  priority: RecommendationPriority;
  category: string;
  recommendation: string;
}

export interface ContentOptimizerNotFound {
  state: "target_unreachable";
  url: string;
  reason: string;
}

export interface ContentOptimizerAnalysed {
  state: "analysed";
  url: string;
  keyword: string;
  target: PageContentMetrics;
  /** Ranking pages the target keyword's SERP returned, best-effort crawled. */
  competitors: CompetitorPageMetrics[];
  /** AI-generated qualitative assessment — NOT a calibrated industry score. */
  grade: ContentOptimizerGrade;
  gradeSummary: string;
  recommendations: ContentOptimizerRecommendation[];
  coverage: {
    serpResultsFound: number;
    competitorsRequested: number;
    competitorsCrawled: number;
    /** True when the SERP could not be fetched at all — the grade is then
     *  based on the target page and general on-page practice alone. */
    serpUnavailable: boolean;
  };
  fetchedAt: string;
}

/**
 * Two mutually exclusive outcomes. `target_unreachable` means the page
 * itself could not be fetched — an ordinary outcome for a URL check, not a
 * fault — narrow on `state` before reading anything else.
 */
export type ContentOptimizerResult =
  | ContentOptimizerNotFound
  | ContentOptimizerAnalysed;
