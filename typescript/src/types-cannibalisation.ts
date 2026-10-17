// Keyword-cannibalisation types, split out of types.ts to keep that file under
// the lint line budget (same pattern as types-competitors.ts).
//
// Mirrors src/types/schemas/gsc-cannibalisation.ts.

/**
 * Analysis windows, deliberately short and deliberately NOT the full 16-month
 * Search Console range. Cannibalisation means two pages competing for a query
 * *at the same time*; over a long window "two pages received impressions" also
 * describes a page migration, and reporting that as cannibalisation would send
 * someone to consolidate two pages that are already consolidated.
 */
export type CannibalisationWindow =
  | "last_7_days"
  | "last_28_days"
  | "last_3_months";

/**
 * Finding order. Both options are a single measured quantity — there is
 * deliberately no composite severity score.
 *
 * - `impressions` — total impressions the competing pages account for, highest
 *   first.
 * - `position_spread` — gap between the best and worst average position among
 *   the competing pages, smallest first (near-interchangeable pages).
 */
export type CannibalisationSort = "impressions" | "position_spread";

export interface CannibalisationInput {
  projectId: string;
  /** Defaults to "last_28_days". */
  window?: CannibalisationWindow;
  /** Defaults to "impressions". */
  sort?: CannibalisationSort;
}

/**
 * One page competing for a query. Every field is Search Console's own figure for
 * that (query, page) pair over the window — never recomputed — so the numbers
 * reconcile with the Search Console UI.
 */
export interface CannibalisationCompetingPage {
  page: string;
  clicks: number;
  impressions: number;
  /** As returned by Search Console (0–1), not recomputed from clicks/impressions. */
  ctr: number;
  /** Average position of THIS page for THIS query while it appeared. */
  position: number;
}

export interface CannibalisationFinding {
  query: string;
  /** At least `thresholds.minCompetingPages`, ordered by impressions descending. */
  competingPages: CannibalisationCompetingPage[];
  /** Sum of impressions across `competingPages` — measured, not modelled. */
  totalImpressions: number;
  totalClicks: number;
  /** Best (numerically lowest) average position among the competing pages. */
  bestPosition: number;
  /** Worst average position minus best, across the competing pages. */
  positionSpread: number;
  /**
   * Pages that appeared for this query but fell below the per-page impression
   * floor and were excluded. Surfaced so `competingPages.length` is never
   * mistaken for the total number of URLs Search Console associated with the
   * query.
   */
  excludedLowVolumePages: number;
}

/**
 * The thresholds this report was produced with, returned alongside it so a
 * reader can tell whether a threshold — rather than the absence of a problem —
 * is why a query is missing.
 */
export interface CannibalisationThresholds {
  minCompetingPages: number;
  minPageImpressions: number;
  minQueryImpressions: number;
}

export interface CannibalisationCoverage {
  /** Distinct queries seen in the window. */
  analysedQueries: number;
  /** (query, page) rows the analysis actually read. */
  analysedRows: number;
  /** Queries with 2+ pages above the per-page floor, before the query-level floor. */
  queriesWithMultiplePages: number;
  /**
   * True when Search Console had more (query, page) rows than the fetch ceiling
   * allows, so the scan is a sample and may miss findings.
   */
  truncated: boolean;
}

/** No Search Console property is bound to the project. The fix is to connect
 *  one, not to wait for data. */
export interface CannibalisationNotConnected {
  state: "not_connected";
}

/** A property is bound but the Google grant behind it can no longer be used
 *  (revoked/expired refresh token, or a 401/403 from Google). */
export interface CannibalisationRequiresReconnect {
  state: "requires_reconnect";
  siteUrl: string;
}

/** Search Console returned nothing for the window. An absence of data, NOT a
 *  clean bill of health — it must never render as "no problems". */
export interface CannibalisationNoSearchData {
  state: "no_search_data";
  siteUrl: string;
  window: CannibalisationWindow;
  startDate: string;
  endDate: string;
}

export interface CannibalisationAnalysed {
  state: "analysed";
  siteUrl: string;
  window: CannibalisationWindow;
  startDate: string;
  endDate: string;
  sort: CannibalisationSort;
  /** Empty means "we looked and found none" — see `coverage` for the proof. */
  findings: CannibalisationFinding[];
  /** Findings before the display cap; equals `findings.length` unless capped. */
  totalFindings: number;
  coverage: CannibalisationCoverage;
  thresholds: CannibalisationThresholds;
}

/**
 * Four mutually exclusive outcomes, kept distinct on purpose.
 *
 * Narrow on `state` before reading anything else. `not_connected`,
 * `requires_reconnect`, `no_search_data` and an `analysed` report with zero
 * findings are four different facts, and collapsing them into one empty state
 * tells a user "you have no cannibalisation" when the truth is "we have no
 * data".
 */
export type CannibalisationReport =
  | CannibalisationNotConnected
  | CannibalisationRequiresReconnect
  | CannibalisationNoSearchData
  | CannibalisationAnalysed;
