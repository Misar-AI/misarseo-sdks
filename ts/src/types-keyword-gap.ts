// Keyword-gap comparison types, split out of types.ts to keep that file under
// the lint line budget (same pattern as types-competitors.ts).
//
// Mirrors src/types/schemas/keywordGap.ts. Every numeric field below is either
// something the provider measured or `null` — there is deliberately no composite
// "opportunity score", because any such number would be a weighting we invented
// presented with the confidence of a measurement.

export type KeywordGapSortField = "volume" | "theirPosition" | "ourPosition";

export type KeywordGapSortOrder = "asc" | "desc";

/**
 * How one keyword compares, from measured positions only.
 *
 * - `missing` — a competitor ranks for it and our domain does not. A provable
 *   absence.
 * - `behind` — we both rank; their best position is better (lower) than ours.
 * - `tied` — we both rank at the same position. Its own outcome because the two
 *   figures come from separate lookups, so equal positions genuinely occur.
 * - `ahead` — we both rank; our position is better than theirs.
 * - `unknown` — we cannot tell whether we rank for it: our own fetched set hit
 *   the per-domain cap AND this keyword's volume sits at or below that set's
 *   `volumeFloor`, so its absence from our slice is a limit of what was fetched,
 *   not evidence about our rankings.
 *
 * NEVER collapse `missing` and `unknown` into a boolean "we rank / we don't".
 * `unknown` is the absence of a measurement; `missing` is a measurement.
 */
export type KeywordGapClassification =
  | "missing"
  | "behind"
  | "tied"
  | "ahead"
  | "unknown";

export interface KeywordGapInput {
  projectId: string;
  /**
   * 1–3 competitor domains (bare domain or full URL). Your own domain is read
   * from the project row and is NOT a field here — the comparison is always
   * attributed to the project's own site.
   */
  competitorDomains: string[];
  locationCode?: number;
  languageCode?: string;
  /** Count subdomains as part of the same domain. Defaults to true. */
  includeSubdomains?: boolean;
  /** Defaults to "volume". All three sorts are measured columns. */
  sortField?: KeywordGapSortField;
  /** Defaults to "desc". Nulls sort last in BOTH directions. */
  sortOrder?: KeywordGapSortOrder;
  /** Omit for every classification. It never defaults to hiding `unknown`. */
  classifications?: KeywordGapClassification[];
}

/** One competitor's standing on a keyword. */
export interface KeywordGapCompetitorCell {
  domain: string;
  /**
   * null means "not in the set fetched for this domain" — which is only the same
   * as "does not rank" when that domain's coverage is not `truncated`.
   */
  position: number | null;
  url: string | null;
}

export interface KeywordGapRow {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  ourPosition: number | null;
  ourUrl: string | null;
  /** Best (numerically lowest) position among the compared competitors. */
  bestCompetitorPosition: number | null;
  bestCompetitorDomain: string | null;
  /** One entry per compared competitor, in the order they were requested. */
  competitors: KeywordGapCompetitorCell[];
  classification: KeywordGapClassification;
}

/**
 * What was actually read for one domain — the honesty ledger for the table. It
 * is what lets a caller say "compared against the top 1,000 of 12,904 keywords"
 * instead of implying the comparison was exhaustive.
 */
export interface KeywordGapDomainCoverage {
  domain: string;
  role: "own" | "competitor";
  keywordsFetched: number;
  /** What the provider says the domain ranks for in total; null when unknown. */
  keywordsTotal: number | null;
  /** True when the fetched set is a slice of a larger one. */
  truncated: boolean;
  /** Lowest measured search volume in the fetched set; null when none had one. */
  volumeFloor: number | null;
  unavailable: boolean;
  unavailableReason: string | null;
}

export interface KeywordGapResult {
  ourDomain: string;
  locationCode: number;
  languageCode: string;
  includeSubdomains: boolean;
  /**
   * True when no configured provider can answer this at all (the free provider
   * has no ranked-keyword source). Check this BEFORE reading `rows`: an empty
   * `rows` on an unavailable result means "we could not look", not "your
   * competitors rank for nothing".
   */
  unavailable: boolean;
  unavailableReason: string | null;
  /** Our own domain first, then the competitors in request order. */
  coverage: KeywordGapDomainCoverage[];
  rows: KeywordGapRow[];
  /** Rows matching the requested classifications, before the `rowLimit` cap. */
  totalRows: number;
  rowLimit: number;
  sortField: KeywordGapSortField;
  sortOrder: KeywordGapSortOrder;
  fetchedAt: string;
}
