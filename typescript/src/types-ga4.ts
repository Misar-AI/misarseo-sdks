/**
 * Google Analytics (GA4) SDK types. Sibling module to `types.ts` for the same
 * "keep the main file under the lint line budget" reason `types-cannibalisation.ts`
 * / `types-content-decay.ts` / `types-gsc-insights.ts` already exist.
 */

export interface Ga4Property {
  /** Bare numeric id, no "properties/" prefix. */
  propertyId: string;
  displayName: string;
  /** The GA4 account's display name this property belongs to. */
  accountName: string;
  /** PROPERTY_TYPE_ORDINARY | PROPERTY_TYPE_SUBPROPERTY | PROPERTY_TYPE_ROLLUP,
   *  verbatim from Google — not filtered. */
  propertyType: string;
  /** Whether this is the property currently bound to the project the call was
   *  scoped to. */
  isSelected: boolean;
}

export interface Ga4ConnectionStatusInput {
  projectId: string;
}

export interface Ga4ConnectionInfo {
  propertyId: string;
  propertyDisplayName: string | null;
  connectedAccountEmail: string | null;
  connectedAt: string | null;
}

export interface Ga4ConnectionStatusResponse {
  /** Whether the user has a Google OAuth grant at all — a SEPARATE grant from
   *  Search Console's own, even for a user who has connected both. */
  hasGrant: boolean;
  /** `null` if no property has been selected for this project. */
  connection: Ga4ConnectionInfo | null;
}

export interface Ga4ListPropertiesInput {
  projectId: string;
}

export interface Ga4ListPropertiesResponse {
  /**
   * `true` (with an empty `properties` list) means the stored grant can no
   * longer reach Google Analytics — prompt `authClient`'s connect flow again
   * rather than reading this as "the account has no properties".
   */
  requiresReconnect: boolean;
  properties: Ga4Property[];
}

export interface Ga4SetPropertyInput {
  projectId: string;
  /** Bare numeric id, taken verbatim from `listProperties()`. Re-validated
   *  against the caller's LIVE property list server-side on every call. */
  propertyId: string;
}

export interface Ga4Connection {
  id: string;
  projectId: string;
  organizationId: string;
  propertyId: string;
  propertyDisplayName: string | null;
  connectedByUserId: string;
  connectedAccountEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ga4DisconnectInput {
  projectId: string;
}

export interface Ga4ArchiveInput {
  projectId: string;
  /** `YYYY-MM-DD`. Required — reads MisarSEO's own Postgres, so there is no
   *  convenience `dateRange` to fall back to. */
  startDate: string;
  /** `YYYY-MM-DD`, not before `startDate`. Required. */
  endDate: string;
}

/** One archived day of site-level GA4 totals. */
export interface Ga4DailyRow {
  /** `YYYY-MM-DD` in the property's own reporting timezone. */
  date: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  /** 0-1 fraction, as GA4 returned it. */
  engagementRate: number;
  /** 0-1 fraction, as GA4 returned it. */
  bounceRate: number;
  /** GA4's own attribution-modeled figure — can be fractional. */
  conversions: number;
  screenPageViews: number;
}

export interface Ga4DailyResponse {
  /** `false` means the project has no connected property, NOT that the
   *  archive is empty — `reason` and `connectUrl` are then set and `rows` is
   *  absent. Arrives with HTTP 200, so branch on this before reading
   *  anything else. */
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  propertyId?: string;
  rowCount?: number;
  rows?: Ga4DailyRow[];
}

/** One archived day's row for one dimension value (a channel group, or a
 *  landing page path). */
export interface Ga4DimensionRow {
  /** `YYYY-MM-DD` in the property's own reporting timezone. */
  date: string;
  /** The channel-group name, or the landing-page path, as GA4 returned it. */
  value: string;
  sessions: number;
  activeUsers: number;
  /** 0-1 fraction. */
  engagementRate: number;
  conversions: number;
}

export interface Ga4DimensionResponse {
  /** Same not-connected convention as {@link Ga4DailyResponse}. */
  ok: boolean;
  reason?: string;
  connectUrl?: string;
  propertyId?: string;
  rowCount?: number;
  rows?: Ga4DimensionRow[];
}

export interface Ga4LandingPagesInput extends Ga4ArchiveInput {
  /** 1-1000. Landing-page cardinality is unbounded for a large site, unlike
   *  the daily totals or the under-a-dozen-value channel breakdown. */
  limit?: number;
}
