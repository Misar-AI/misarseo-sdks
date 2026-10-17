// Content-decay types, split out of types.ts to keep that file under the lint
// line budget (same pattern as types-cannibalisation.ts).
//
// Mirrors src/types/schemas/gsc-content-decay.ts.

/**
 * `window` selects the RECENT period length; the EARLIER period compared
 * against it is the same length immediately before it — a period-over-period
 * comparison, not a calendar-month split.
 */
export type ContentDecayWindow = "last_28_days" | "last_90_days";

export interface ContentDecayInput {
  projectId: string;
  /** Defaults to "last_28_days". */
  window?: ContentDecayWindow;
  /** A page must have had at least this many clicks in the earlier window to
   *  be considered at all. Defaults to 10. */
  minEarlierClicks?: number;
  /** How big a decline (percent) is required to be reported. 0 disables
   *  reporting entirely. Defaults to 20. */
  declineThresholdPct?: number;
}

/**
 * One declining page. Every figure is summed or impression-weighted from
 * Search Console's own archived per-page rows — never estimated.
 */
export interface ContentDecayFinding {
  url: string;
  earlierClicks: number;
  recentClicks: number;
  /** Always negative — a finding only exists once the decline met
   *  `declineThresholdPct`. */
  clicksDeltaPct: number;
  earlierImpressions: number;
  recentImpressions: number;
  /** Null when `earlierImpressions` is 0. */
  impressionsDeltaPct: number | null;
  /** Impression-weighted average position over the window. Null only when
   *  the window's impressions are 0. */
  earlierPosition: number | null;
  recentPosition: number | null;
}

export interface ContentDecayThresholds {
  minEarlierClicks: number;
  declineThresholdPct: number;
}

export interface ContentDecayCoverage {
  /** Distinct archived days seen in each half of the window. */
  earlierArchivedDays: number;
  recentArchivedDays: number;
  /** Distinct pages seen archived in each half, before thresholds filter
   *  them down to `findings`. */
  earlierPages: number;
  recentPages: number;
}

/** No Search Console property is bound to the project. The fix is to connect
 *  one, not to wait for data. */
export interface ContentDecayNotConnected {
  state: "not_connected";
}

/** Neither window has ANY archived per-page rows — there is nothing to
 *  compare. An absence of data, NOT a measurement of zero decay. */
export interface ContentDecayInsufficientHistory {
  state: "insufficient_history";
  siteUrl: string;
  window: ContentDecayWindow;
  recentStart: string;
  recentEnd: string;
  earlierStart: string;
  earlierEnd: string;
}

export interface ContentDecayAnalysed {
  state: "analysed";
  siteUrl: string;
  window: ContentDecayWindow;
  recentStart: string;
  recentEnd: string;
  earlierStart: string;
  earlierEnd: string;
  /** Worst decline first. Empty means "we looked and found none" — see
   *  `coverage` for the proof. */
  findings: ContentDecayFinding[];
  /** Findings before the display cap; equals `findings.length` unless
   *  capped. */
  totalFindings: number;
  thresholds: ContentDecayThresholds;
  coverage: ContentDecayCoverage;
}

/**
 * Three mutually exclusive outcomes, kept distinct on purpose.
 *
 * Narrow on `state` before reading anything else. Unlike
 * `CannibalisationReport`, there is no `requires_reconnect` state: this report
 * makes NO live Search Console call, so a revoked Google grant cannot affect
 * it — it reads only MisarSEO's own archive.
 */
export type ContentDecayReport =
  | ContentDecayNotConnected
  | ContentDecayInsufficientHistory
  | ContentDecayAnalysed;
