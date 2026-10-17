// Sitemaps list/get types (GAP-060), split out to keep types.ts under the
// lint line budget (same pattern as types-gsc-insights.ts).
//
// Mirrors src/types/schemas/gsc-sitemaps.ts.

export interface GscSitemapsInput {
  projectId: string;
  /** A specific sitemap's own URL. Omitted lists every sitemap Search
   *  Console has on record for the property. */
  feedpath?: string;
}

export interface GscSitemapContent {
  type?: string;
  submitted?: string;
}

export interface GscSitemap {
  path: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  warnings?: string;
  errors?: string;
  contents?: GscSitemapContent[];
}

/**
 * Three mutually exclusive outcomes — narrow on `state` first. `analysed`
 * carries every sitemap when `feedpath` was omitted, or a one-entry array
 * naming just that path otherwise.
 */
export type GscSitemapsReport =
  | { state: "not_connected" }
  | { state: "requires_reconnect"; siteUrl: string }
  | { state: "analysed"; siteUrl: string; sitemaps: GscSitemap[] };
