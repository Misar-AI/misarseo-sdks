// CTR-by-position and anonymous-queries types (GAP-073 remainder), split out
// of types.ts to keep that file under the lint line budget (same pattern as
// types-content-decay.ts).
//
// Mirrors src/types/schemas/gsc-ctr-by-position.ts and
// src/types/schemas/gsc-anonymous-queries.ts.

// ─── CTR by position ────────────────────────────────────────────────────────

export type GscCtrByPositionDimension = "query" | "page";

export type GscCtrByPositionDateRange =
  | "last_7_days"
  | "last_28_days"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "last_16_months";

export interface CtrByPositionInput {
  projectId: string;
  /** Defaults to "query". */
  dimension?: GscCtrByPositionDimension;
  /** Defaults to "last_28_days". Ignored when startDate+endDate are both
   *  given. */
  dateRange?: GscCtrByPositionDateRange;
  startDate?: string;
  endDate?: string;
}

export type CtrByPositionBucketKey =
  | "pos1to3"
  | "pos4to10"
  | "pos11to20"
  | "pos21Plus";

/** One position bucket's REAL, clicks-weighted CTR from this project's own
 *  archived Search Console history — never a fabricated industry curve. */
export interface CtrByPositionBucket {
  key: CtrByPositionBucketKey;
  label: string;
  clicks: number;
  impressions: number;
  /** Null when the bucket has zero impressions (empty, not zero-CTR). */
  ctr: number | null;
  rowCount: number;
  averagePosition: number | null;
}

export interface CtrByPositionNotConnected {
  state: "not_connected";
}

/** A property is bound but the archive has no rows at all for this
 *  dimension/window — an absence of data, NOT a measurement of zero traffic. */
export interface CtrByPositionNoData {
  state: "no_data";
  siteUrl: string;
  dimension: GscCtrByPositionDimension;
  startDate: string;
  endDate: string;
}

export interface CtrByPositionAnalysed {
  state: "analysed";
  siteUrl: string;
  dimension: GscCtrByPositionDimension;
  startDate: string;
  endDate: string;
  /** Best-position-first: 1–3, 4–10, 11–20, 21+. */
  buckets: CtrByPositionBucket[];
  coverage: {
    archivedDays: number;
    distinctValues: number;
    rowCount: number;
  };
}

/** Three mutually exclusive outcomes — narrow on `state` first. No
 *  `requires_reconnect`: this report makes NO live Search Console call. */
export type CtrByPositionReport =
  | CtrByPositionNotConnected
  | CtrByPositionNoData
  | CtrByPositionAnalysed;

// ─── Anonymous (anonymized) queries estimate ───────────────────────────────

export type GscAnonymousQueriesDateRange = GscCtrByPositionDateRange;

export interface AnonymousQueriesInput {
  projectId: string;
  /** Defaults to "last_28_days". Ignored when startDate+endDate are both
   *  given. */
  dateRange?: GscAnonymousQueriesDateRange;
  startDate?: string;
  endDate?: string;
}

export interface AnonymousQueriesNotConnected {
  state: "not_connected";
}

export interface AnonymousQueriesRequiresReconnect {
  state: "requires_reconnect";
  siteUrl: string;
}

export interface AnonymousQueriesNoSearchData {
  state: "no_search_data";
  siteUrl: string;
  startDate: string;
  endDate: string;
}

export interface AnonymousQueriesAnalysed {
  state: "analysed";
  siteUrl: string;
  startDate: string;
  endDate: string;
  totalClicks: number;
  totalImpressions: number;
  namedClicks: number;
  namedImpressions: number;
  anonymizedClicks: number;
  anonymizedImpressions: number;
  /** Null when the corresponding total is 0 — nothing to divide by, not a 0%
   *  share. */
  anonymizedImpressionsShare: number | null;
  anonymizedClicksShare: number | null;
  namedQueryCount: number;
  /** True when the named-query fetch returned exactly the row cap — the
   *  anonymized figures then OVERSTATE true privacy anonymization. ALWAYS
   *  check this before presenting the estimate. */
  possiblyRowCapped: boolean;
}

/** Four mutually exclusive outcomes — narrow on `state` first. Unlike
 *  ctr-by-position, this DOES make live Search Console calls, hence
 *  `requires_reconnect`. */
export type AnonymousQueriesReport =
  | AnonymousQueriesNotConnected
  | AnonymousQueriesRequiresReconnect
  | AnonymousQueriesNoSearchData
  | AnonymousQueriesAnalysed;
