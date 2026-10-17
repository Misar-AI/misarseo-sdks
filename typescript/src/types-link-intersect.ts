// Link-intersect types, split out of types.ts to keep that file under the lint
// line budget (same pattern as types-keyword-gap.ts).
//
// Mirrors src/types/schemas/linkIntersect.ts. Every numeric field below is
// either something the provider measured or `null` — there is deliberately no
// composite "opportunity score" and no "link difficulty", because any such
// number would be a weighting we invented presented with the confidence of a
// measurement.
//
// There is also no `includeSubdomains` switch: the underlying provider path
// always sends `include_subdomains: true`, so a toggle would be a control that
// does nothing.

/**
 * Whether "this domain does not link to us" is a measurement or a limit.
 *
 * - `proven` — our own referring-domain read either covered the whole profile,
 *   or covered everything at or above this domain's authority, so its absence
 *   from our set is a reading.
 * - `unproven` — our read was cut off before it could rule this domain out. It
 *   may already link to us. It is returned (hiding it would silently drop real
 *   candidates) but excluded from `provenRows`.
 *
 * NEVER collapse the two into a boolean "we have this link / we don't".
 * `unproven` is the absence of a measurement; `proven` is a measurement.
 */
export type LinkIntersectAbsence = "proven" | "unproven";

/**
 * Sortable columns. All three are values the provider measured.
 *
 * - `competitors` — how many compared competitors' read slices contain the row.
 * - `authority` — the linking domain's own rank, 0–100. Null where unreported.
 * - `linkingPages` — pages on the domain linking to one compared competitor.
 */
export type LinkIntersectSortField =
  | "competitors"
  | "authority"
  | "linkingPages";

export type LinkIntersectSortOrder = "asc" | "desc";

export interface LinkIntersectInput {
  projectId: string;
  /**
   * 2–4 competitor domains (bare domain or full URL). Your own domain is read
   * from the project row and is NOT a field here — the intersect is always
   * attributed to the project's own site. Duplicates and your own domain are
   * dropped; fewer than 2 survivors is a validation error, because with one
   * competitor this is a referring-domain diff rather than an intersect.
   *
   * Each competitor is a separate billable referring-domains lookup.
   */
  competitorDomains: string[];
  /**
   * "Links to at least this many of them". Defaults to 2, and is clamped
   * server-side to the number of competitors that actually resolved — read
   * `minCompetitors` on the result for what was really applied.
   */
  minCompetitors?: number;
  /** Defaults to true: unproven rows are labelled, never hidden by default. */
  includeUnproven?: boolean;
  /** Defaults to "competitors". All three sorts are measured columns. */
  sortField?: LinkIntersectSortField;
  /** Defaults to "desc". */
  sortOrder?: LinkIntersectSortOrder;
}

/** One competitor's relationship with one linking domain. */
export interface LinkIntersectCompetitorCell {
  domain: string;
  /**
   * True when the linking domain was inside the slice read for that competitor.
   * False means "not in the slice we read" — which is only the same as "does
   * not link to them" when that competitor's coverage is not `truncated`.
   */
  found: boolean;
  /** Pages on the linking domain pointing at this competitor; null if unreported. */
  linkingPages: number | null;
  /** Individual links to this competitor; null if unreported. */
  backlinks: number | null;
}

export interface LinkIntersectRow {
  /** The linking domain — the prospect. */
  domain: string;
  /** The linking domain's own authority, 0–100, as the provider reported it. */
  authority: number | null;
  /** Provider spam score for the linking domain; null when unreported. */
  spamScore: number | null;
  /** How many compared competitors' read slices contain this domain. */
  competitorsLinking: number;
  /** One cell per compared competitor, in the order they were requested. */
  competitors: LinkIntersectCompetitorCell[];
  /**
   * The highest number of linking pages this domain points at any ONE compared
   * competitor — deliberately not a sum, which would mix measured cells with
   * unreported ones and read as a total that was never established.
   */
  linkingPages: number | null;
  /** Which competitor `linkingPages` was measured against; null when none was. */
  linkingPagesCompetitor: string | null;
  absence: LinkIntersectAbsence;
}

/**
 * What was actually read for one domain — the honesty ledger for the table. It
 * is what lets a caller say "read 5,000 of 61,204 domains linking to rival.com"
 * instead of implying the intersect was exhaustive.
 */
export interface LinkIntersectCoverage {
  domain: string;
  role: "own" | "competitor";
  domainsRead: number;
  /** Provider's referring-domain total for this target; null when unknown. */
  domainsTotal: number | null;
  /** Billable provider requests actually spent on this target. */
  requestsSpent: number;
  /** The request budget for this target's role. */
  requestBudget: number;
  /** True when the read set is a slice of a larger one. */
  truncated: boolean;
  /**
   * Lowest measured authority in the read set; null when none carried one. On
   * the `own` entry this is the boundary below which absence stops being
   * evidence.
   */
  authorityFloor: number | null;
  unavailable: boolean;
  unavailableReason: string | null;
}

/**
 * How far our own read reached, stated as a bound rather than implied.
 *
 * - `complete` — the provider's referring-domain total for us was no larger
 *   than what we read, so every absence is proven and `authorityFloor` is
 *   irrelevant (and null).
 * - `authority-floor` — our read was cut off. Absence is proven only strictly
 *   above `authorityFloor`; at or below it rows are `unproven`.
 */
export interface LinkIntersectAbsenceBound {
  mode: "complete" | "authority-floor";
  authorityFloor: number | null;
  /** Referring domains of ours actually read, for the disclosure line. */
  ourDomainsRead: number;
  /** What the provider says links to us in total; null when it did not say. */
  ourDomainsTotal: number | null;
}

export interface LinkIntersectResult {
  ourDomain: string;
  /**
   * True when no configured provider can answer this at all — backlink graphs
   * need a proprietary web-scale crawl, so the free provider refuses
   * permanently. Check this BEFORE reading `rows`: on an unavailable result the
   * empty `rows`, and the zeroes in `totalRows` / `provenRows` / `unprovenRows`,
   * mean "we could not look", not "no linking opportunities exist".
   */
  unavailable: boolean;
  unavailableReason: string | null;
  /** Our own domain first, then the competitors in request order. */
  coverage: LinkIntersectCoverage[];
  rows: LinkIntersectRow[];
  /** Rows meeting the threshold and proof filter, before the `rowLimit` cap. */
  totalRows: number;
  /**
   * The headline count: rows meeting the threshold whose absence from our
   * profile is proven. Unproven rows are excluded by construction, so this
   * number never rests on an absence that was not established.
   */
  provenRows: number;
  /** Rows meeting the threshold whose absence could not be proven. */
  unprovenRows: number;
  absenceBound: LinkIntersectAbsenceBound;
  /**
   * Where the `authority` column came from, carried as data so a label is never
   * a hardcoded assumption. Always the provider's link-graph domain rank here —
   * never the keyless Tranco popularity rank behind the free-mode Domain
   * Authority card.
   */
  authoritySource: "provider_domain_rank";
  /** The threshold actually applied, after clamping to the competitor count. */
  minCompetitors: number;
  /** What the caller asked for, so a clamp can be explained rather than hidden. */
  minCompetitorsRequested: number;
  includeUnproven: boolean;
  rowLimit: number;
  sortField: LinkIntersectSortField;
  sortOrder: LinkIntersectSortOrder;
  fetchedAt: string;
}
