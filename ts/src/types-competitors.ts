// SERP-competitor discovery types, split out of types.ts to keep that file
// under the lint line budget (same pattern as types-rank-tracking.ts).

export type SerpCompetitorResultType =
  | "organic"
  | "paid"
  | "featured_snippet"
  | "local_pack";

export type SerpCompetitorsSortBy =
  | "visibility"
  | "traffic_estimate"
  | "avg_position"
  | "keyword_count";

export interface FindSerpCompetitorsInput {
  projectId: string;
  /** Keywords whose SERPs are compared (1-100). */
  keywords: string[];
  locationCode?: number;
  languageCode?: string;
  /** SERP result types to include. Defaults to organic and local_pack. */
  resultTypes?: SerpCompetitorResultType[];
  /** Domains to exclude from results (e.g. the caller's own site). */
  excludeDomains?: string[];
  /** Count subdomains as part of the same competitor domain. */
  includeSubdomains?: boolean;
  /** Sort order for returned competitors. Defaults to visibility. */
  sortBy?: SerpCompetitorsSortBy;
  /** Maximum competitors to return (1-100). Defaults to 50. */
  limit?: number;
  /** Rows to skip for pagination. */
  offset?: number;
}

export interface SerpCompetitorRow {
  domain: string | null;
  avgPosition: number | null;
  medianPosition: number | null;
  keywordsCount: number | null;
  /** No honest free-tier source — null unless the paid DataForSEO provider is enabled. */
  visibility: number | null;
  /** No honest free-tier source — null unless the paid DataForSEO provider is enabled. */
  etv: number | null;
  /** No honest free-tier source — null unless the paid DataForSEO provider is enabled. */
  rating: number | null;
  keywordsPositions: Record<string, number[]> | null;
}

export interface FindSerpCompetitorsResponse {
  competitors: SerpCompetitorRow[];
}
