// Unlinked Brand Mentions (GAP-131) + Media Monitoring (GAP-183) types, split
// into their own module for the same reason types-content-optimizer.ts is.
//
// Mirrors src/types/schemas/mentions.ts.

/** Reused from the AI Search resource's own citation-platform breakdown
 *  (GAP-148) — a domain classified into one of a small, explicit set of
 *  known social/forum/news platforms. */
export type OffsitePlatformId =
  | "youtube"
  | "tiktok"
  | "reddit"
  | "wikipedia"
  | "linkedin"
  | "quora";

export interface OffsitePlatformBreakdownEntry {
  platform: OffsitePlatformId;
  label: string;
  citationCount: number;
}

// ─── GAP-131 — Unlinked Brand Mentions ──────────────────────────────────────

export interface UnlinkedMentionsInput {
  projectId: string;
  /** Brand name or bare domain, searched as a SERP QUERY (not a URL to fetch). */
  brand: string;
  /** Bare registrable domain each result page is checked for a link to. */
  trackedDomain: string;
  locationCode?: number;
  languageCode?: string;
}

export type UnlinkedMentionStatus = "linked" | "unlinked" | "unreachable";

/** One SERP result found for `brand`, with whether its page already links to
 *  `trackedDomain`. */
export interface UnlinkedMentionCandidate {
  /** 1-based organic SERP position. */
  rank: number;
  url: string;
  domain: string;
  title: string;
  description: string;
  status: UnlinkedMentionStatus;
  /** GAP-148's platform classification of this result's domain — null when
   *  it matches none of the known social/forum/news platforms. */
  platform: OffsitePlatformId | null;
}

export interface UnlinkedMentionsUnavailable {
  state: "serp_unavailable";
  brand: string;
  trackedDomain: string;
  reason: string;
}

export interface UnlinkedMentionsAnalysed {
  state: "analysed";
  brand: string;
  trackedDomain: string;
  requestedKeyword: string;
  /** Organic SERP results returned for `brand`, before the tracked domain's
   *  own results are excluded and the candidate list is capped. */
  serpResultsFound: number;
  /** How many third-party results were actually fetched and link-checked. */
  candidatesChecked: number;
  candidates: UnlinkedMentionCandidate[];
  /** States the SERP-result-count bound plainly — never an exhaustive web
   *  crawl or a full content index. */
  scopeNote: string;
  fetchedAt: string;
}

/**
 * Two mutually exclusive outcomes. `serp_unavailable` means no free SERP
 * provider could be reached — narrow on `state` before reading anything
 * else, and never treat it as "zero mentions found".
 */
export type UnlinkedMentionsResult =
  | UnlinkedMentionsUnavailable
  | UnlinkedMentionsAnalysed;

// ─── GAP-183 — Media Monitoring ─────────────────────────────────────────────

/** One citation from an already-run Prompt Explorer scan (GAP-148) for this
 *  brand — `PromptExplorerCitation` narrowed to the two fields the
 *  server-side classifier reads. */
export interface MediaMonitoringCitationInput {
  url: string;
  domain: string | null;
}

export interface MediaMonitoringInput extends UnlinkedMentionsInput {
  /** Citations from an ALREADY-RUN Prompt Explorer scan for this brand —
   *  never fetched by this endpoint itself. Omit to leave
   *  `aiCitationPlatforms: null`. */
  citations?: MediaMonitoringCitationInput[];
}

export type MediaMonitoringUnavailable = UnlinkedMentionsUnavailable;

export interface MediaMonitoringAnalysed {
  state: "analysed";
  brand: string;
  trackedDomain: string;
  /** GAP-131 candidates whose domain matched a known social/forum/news
   *  platform — the SERP-discovered half of this report. */
  platformMentions: UnlinkedMentionCandidate[];
  serpResultsFound: number;
  candidatesChecked: number;
  /** GAP-148's per-platform citation breakdown for the `citations` you
   *  passed in, or null when none were supplied. Distinct from an EMPTY
   *  array, which would mean a scan was supplied and cited nothing on a
   *  known platform. */
  aiCitationPlatforms: OffsitePlatformBreakdownEntry[] | null;
  /** States plainly that this is NOT real-time social/forum/news
   *  monitoring — see the resource method's own docblock. */
  scopeNote: string;
  fetchedAt: string;
}

export type MediaMonitoringResult =
  | MediaMonitoringUnavailable
  | MediaMonitoringAnalysed;
