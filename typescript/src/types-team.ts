/**
 * Types for the methods added when the SDK was brought to 100% of the
 * generated manifest (`sdks/manifest.json`): team members, the citations
 * check, and rank-tracking competitors.
 *
 * Request interfaces mirror the route schemas field for field (the contract
 * tests in tests/unit/sdk/contracts compare them). Responses are typed only as
 * far as the handlers commit to a shape.
 */

/** `GET /team/members`. */
export interface TeamMember {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  email?: string | null;
  name?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface TeamMembersResponse {
  /** True for an identity-provider-managed workspace: no member list exists. */
  delegated?: boolean;
  members: TeamMember[];
  invitations: Array<Record<string, unknown>>;
  /** The caller's own role in the organization. */
  role?: string | null;
  [key: string]: unknown;
}

/** `POST /citations` — check which queries' AI answers cite a domain. */
export interface CitationsInput {
  projectId: string;
  domain: string;
  /** Up to 10 are checked; see the endpoint notes for the length limits. */
  queries: string[];
}

export interface CitationsResponse {
  domain: string;
  submitted: number;
  checked: number;
  citations: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
}

/** `GET /rank-tracking/competitors`. */
export interface ListRankCompetitorsInput {
  projectId: string;
  configId: string;
  /** `desktop` (default) or `mobile`; anything else falls back to desktop. */
  device?: "desktop" | "mobile";
}

export interface ListRankCompetitorsResponse {
  competitors: Array<Record<string, unknown>>;
  shareOfVoice?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** `POST` / `DELETE /rank-tracking/competitors` — one competitor domain. */
export interface RankCompetitorInput {
  projectId: string;
  configId: string;
  /** Normalised server-side: scheme, `www.`, path and case are ignored. */
  domain: string;
}
