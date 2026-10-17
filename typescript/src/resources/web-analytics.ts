import type { HttpClient, RequestOptions } from "../http.js";
import type {
  WebAnalyticsDevicesInput,
  WebAnalyticsDevicesResponse,
  WebAnalyticsSourcesInput,
  WebAnalyticsSourcesResponse,
  WebAnalyticsSummaryInput,
  WebAnalyticsSummaryResponse,
  WebAnalyticsTopPagesInput,
  WebAnalyticsTopPagesResponse,
} from "../types.js";

/**
 * Web Analytics (GAP-120) + AI referral attribution (GAP-122) resource.
 *
 * First-party, cookieless data collected by the project's own tracking
 * snippet (`/api/analytics/snippet.js`, pasted once into the audited site's
 * own `<head>`) — every method here is free and reads MisarSEO's own
 * Postgres directly, with sub-minute freshness and no long-TTL cache.
 *
 * There is no `connect()`/`ok: false, reason: "not_connected"` pattern the
 * way `GscResource`/`BingResource` have: there is no external account to
 * connect. An empty range means the snippet has not sent hits for that
 * window yet, not a missing connection.
 */
export class WebAnalyticsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Sessions/pageviews/bounce-rate time series over a date range.
   * `totals.bounceRate` is null (not 0) when there were no sessions in the
   * range — "nothing to measure" is distinct from "zero bounces".
   */
  summary(
    input: WebAnalyticsSummaryInput,
    options?: RequestOptions,
  ): Promise<WebAnalyticsSummaryResponse> {
    return this.http.post<WebAnalyticsSummaryResponse>(
      "/web-analytics/summary",
      input,
      options,
    );
  }

  /**
   * Top pages by view count, plus separate entry-page and exit-page
   * breakdowns. `limit` (1-200, default 50) applies to each list
   * independently.
   */
  topPages(
    input: WebAnalyticsTopPagesInput,
    options?: RequestOptions,
  ): Promise<WebAnalyticsTopPagesResponse> {
    return this.http.post<WebAnalyticsTopPagesResponse>(
      "/web-analytics/top-pages",
      input,
      options,
    );
  }

  /**
   * Referrer/channel/UTM breakdown — the surface AI referral attribution
   * (GAP-122) lands on: `aiReferral.bySource` breaks the `ai-referral`
   * channel out by assistant.
   *
   * Always read `aiReferral.undercountNote` alongside `aiReferral.bySource`:
   * industry measurement puts a large share of real AI-assistant referrals
   * arriving with no referrer header at all, landing in the `direct`
   * channel instead — this number is a measurable floor, never a complete
   * count.
   */
  sources(
    input: WebAnalyticsSourcesInput,
    options?: RequestOptions,
  ): Promise<WebAnalyticsSourcesResponse> {
    return this.http.post<WebAnalyticsSourcesResponse>(
      "/web-analytics/sources",
      input,
      options,
    );
  }

  /**
   * Device/browser/OS breakdown. Every field is derived server-side from
   * the visitor's `User-Agent` header at collection time — the snippet
   * itself never sends device information, keeping it small.
   */
  devices(
    input: WebAnalyticsDevicesInput,
    options?: RequestOptions,
  ): Promise<WebAnalyticsDevicesResponse> {
    return this.http.post<WebAnalyticsDevicesResponse>(
      "/web-analytics/devices",
      input,
      options,
    );
  }
}
