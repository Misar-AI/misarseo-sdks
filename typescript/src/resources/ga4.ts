import type { HttpClient, RequestOptions } from "../http.js";
import type {
  Ga4ArchiveInput,
  Ga4Connection,
  Ga4ConnectionStatusInput,
  Ga4ConnectionStatusResponse,
  Ga4DailyResponse,
  Ga4DimensionResponse,
  Ga4DisconnectInput,
  Ga4LandingPagesInput,
  Ga4ListPropertiesInput,
  Ga4ListPropertiesResponse,
  Ga4SetPropertyInput,
} from "../types.js";

/**
 * Google Analytics (GA4) resource.
 * Free — reads from the connected GA4 property, charges no credits.
 *
 * A genuinely new resource shape, not an extension of `gsc`: GA4 uses its OWN
 * OAuth grant (`providerId: "google-analytics"`, separate from Search
 * Console's), its own property-binding lifecycle (list/set/disconnect are
 * part of this SDK surface, unlike GSC's site picker which is a UI-only
 * concern), and reads exclusively from MisarSEO's own nightly-synced archive
 * rather than GSC's live-Google-plus-read-through-archive shape.
 */
export class Ga4Resource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the GA4 connection status for a project: whether the user has a
   * Google OAuth grant at all, and which property (if any) is connected.
   *
   * `hasGrant` here is INDEPENDENT of `gsc.connect()`'s own `hasGrant` — a
   * user who already connected Search Console does not automatically have a
   * Google Analytics grant, since the two use separate providerIds and
   * separate OAuth scopes.
   */
  connect(
    input: Ga4ConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<Ga4ConnectionStatusResponse> {
    return this.http.get<Ga4ConnectionStatusResponse>(
      "/ga4/connection",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Every GA4 property the caller's connected Google account can access —
   * the picker's data source. A live call to the Analytics Admin API
   * (`accountSummaries.list`), not an archive read.
   *
   * Check `requiresReconnect` first: `true` (with an empty `properties`
   * list) means the stored grant can no longer reach Google Analytics.
   */
  listProperties(
    input: Ga4ListPropertiesInput,
    options?: RequestOptions,
  ): Promise<Ga4ListPropertiesResponse> {
    return this.http.get<Ga4ListPropertiesResponse>(
      "/ga4/properties",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Link (or repoint) the project's Google Analytics property. `propertyId`
   * is re-validated against the caller's LIVE property list on every call —
   * it can 404 if the property fell out of the connected account's access
   * since it was last listed.
   */
  setProperty(
    input: Ga4SetPropertyInput,
    options?: RequestOptions,
  ): Promise<{ connection: Ga4Connection }> {
    return this.http.post<{ connection: Ga4Connection }>(
      "/ga4/connection",
      input,
      options,
    );
  }

  /**
   * Remove the project's Google Analytics link. Requires at least the admin
   * role — disconnecting breaks Analytics data for every member, not just
   * the caller.
   */
  disconnect(
    input: Ga4DisconnectInput,
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/ga4/connection", input, options);
  }

  /**
   * MisarSEO's OWN retained daily Google Analytics totals for the project's
   * connected property: sessions, activeUsers, newUsers, engagementRate,
   * bounceRate, conversions, screenPageViews.
   *
   * Free, and makes NO call to Google — reads only what the nightly sync has
   * archived (04:25 UTC). Unlike `gsc.performance()`, there is no live
   * pass-through counterpart for this SDK: GA4 report reads are archive-only
   * by design, so a property with no completed sync simply has no rows yet.
   *
   * Check `ok` first: a project with no connected property answers 200 with
   * `{ ok: false, reason, connectUrl }` and no rows.
   */
  daily(
    input: Ga4ArchiveInput,
    options?: RequestOptions,
  ): Promise<Ga4DailyResponse> {
    return this.http.post<Ga4DailyResponse>("/ga4/daily", input, options);
  }

  /**
   * MisarSEO's OWN retained daily GA4 channel breakdown
   * (`sessionDefaultChannelGroup`) for the project's connected property —
   * isolating Organic Search from every other acquisition channel, the
   * SEO-relevant signal GA4 adds beyond `gsc`'s own click/impression data.
   *
   * Same free/no-live-call/archive-only behavior as `daily()`. Check `ok`
   * first, same convention.
   */
  channels(
    input: Ga4ArchiveInput,
    options?: RequestOptions,
  ): Promise<Ga4DimensionResponse> {
    return this.http.post<Ga4DimensionResponse>(
      "/ga4/channels",
      input,
      options,
    );
  }

  /**
   * MisarSEO's OWN retained daily GA4 landing-page breakdown for the
   * project's connected property: sessions/engagement/conversions per
   * landing page, ordered by sessions descending within each day.
   *
   * Same free/no-live-call/archive-only behavior as `daily()`. `limit`
   * (1-1000) exists because landing-page cardinality is unbounded for a
   * large site, unlike `daily()`'s one-row-per-day shape or `channels()`'s
   * under-a-dozen possible values. Check `ok` first, same convention.
   */
  landingPages(
    input: Ga4LandingPagesInput,
    options?: RequestOptions,
  ): Promise<Ga4DimensionResponse> {
    return this.http.post<Ga4DimensionResponse>(
      "/ga4/landing-pages",
      input,
      options,
    );
  }
}
