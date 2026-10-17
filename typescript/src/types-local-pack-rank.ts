/**
 * Local pack rank check types (GAP-110) — where ONE named business sits in
 * Google's local pack for one keyword+location. See the REST route's own
 * docs for the honest scope: a real, but fragile and opt-in, scrape of
 * Google's own public local search results page, never a stable API.
 */

export interface CreateLocalPackRankConfigInput {
  projectId: string;
  businessName: string;
  keyword: string;
  /** Composed into the query as "<keyword> in <locationLabel>". */
  locationLabel: string;
  languageCode?: string;
}

export interface LocalPackRankConfig {
  id: string;
  projectId: string;
  businessName: string;
  keyword: string;
  locationLabel: string;
  languageCode: string;
  createdAt: string;
}

export interface LocalPackRankConfigsResponse {
  configs: LocalPackRankConfig[];
}

export type LocalPackRankCheckStatus = "found" | "not_found" | "unavailable";

export interface LocalPackRankCheck {
  id: string;
  configId: string;
  status: LocalPackRankCheckStatus;
  /** 1-based rank among parsed local-pack entries. Only set when `status === "found"`. */
  position: number | null;
  /** The on-page business name actually matched. Only set when `status === "found"`. */
  matchedName: string | null;
  /** How many local-pack entries were actually parsed — 0 when blocked/failed. */
  totalResultsParsed: number;
  /** Set when `status === "unavailable"` — never blank on that status. */
  unavailableReason: string | null;
  checkedAt: string;
}

export interface LocalPackRankCheckResult {
  check: LocalPackRankCheck;
}
