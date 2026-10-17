import type { HttpClient, RequestOptions } from "../http.js";
import type {
  AnonymousQueriesInput,
  AnonymousQueriesReport,
  CannibalisationInput,
  CannibalisationReport,
  ContentDecayInput,
  ContentDecayReport,
  CtrByPositionInput,
  CtrByPositionReport,
  GscArchiveInput,
  GscArchiveResponse,
  GscCoverageInput,
  GscCoverageResponse,
  GscHourlyInput,
  GscHourlyResponse,
  GscPerformanceInput,
  GscMetrics,
  GscConnectionStatusInput,
  GscConnectionStatusResponse,
  InspectUrlsInput,
  InspectUrlsResponse,
  GscSitemapsInput,
  GscSitemapsReport,
} from "../types.js";

/**
 * Google Search Console resource.
 * Free — reads from the connected GSC property, charges no credits.
 */
export class GscResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the GSC connection status for a project: whether the user has a
   * Google OAuth grant at all, and which property (if any) is connected.
   */
  connect(
    input: GscConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<GscConnectionStatusResponse> {
    return this.http.get<GscConnectionStatusResponse>(
      "/gsc/connect",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Query Search Console performance data: clicks, impressions, CTR, and
   * average position by query/page/country/device/date.
   *
   * A pure read despite the POST (the body is a filter set, not a mutation),
   * so `{ idempotent: true }` is safe if you want it retried like a GET.
   *
   * `archive` reports how far back MisarSEO's OWN retained history for the
   * property reaches, which is usually earlier than Google's ~16-month floor.
   * The SDK did not declare it, so the one signal that says "there is history
   * here `performance()` cannot reach" was invisible — and `null` there means
   * nothing has been archived yet, never "no traffic".
   */
  performance(
    input: GscPerformanceInput,
    options?: RequestOptions,
  ): Promise<GscMetrics> {
    return this.http.post<GscMetrics>("/gsc/performance", input, options);
  }

  /**
   * MisarSEO's OWN retained daily Search Console totals for the project's
   * connected property, over an ARBITRARY date range.
   *
   * This is the only way to read history past Search Console's ~16-month
   * window, and that distinction is the whole reason the route exists.
   * `performance()` asks Google, so its `startDate` is clamped to that floor
   * before the request goes out — a date older than it silently yields the
   * clamped window. `archive()` reads MisarSEO's own Postgres and never calls
   * Google, so its window is UNBOUNDED: ask for 2019 and you get whatever was
   * archived for 2019.
   *
   * What it does NOT do is backfill. Rows accumulate as a side effect of
   * running date-grouped `performance()` queries against the property, so the
   * archive starts at the first such query and an empty range means "nothing
   * was archived for those days", not "the property had no traffic".
   *
   * Free — charges no credits and spends none of Google's per-property quota.
   * Both dates are required (`YYYY-MM-DD`, `startDate` not after `endDate`);
   * there is no convenience `dateRange` to fall back on. A pure read despite
   * the POST, so `{ idempotent: true }` is safe if you want it retried.
   *
   * Check `ok` first: a project with no connected property answers 200 with
   * `{ ok: false, reason, connectUrl }` and no rows.
   */
  archive(
    input: GscArchiveInput,
    options?: RequestOptions,
  ): Promise<GscArchiveResponse> {
    return this.http.post<GscArchiveResponse>("/gsc/archive", input, options);
  }

  /**
   * MisarSEO's OWN retained HOURLY Search Console totals for the project's
   * connected property — the hourly counterpart to `archive()`.
   *
   * Same request shape as `archive()` (both dates required, `startDate` not
   * after `endDate`) and the same "reads MisarSEO's own Postgres, never calls
   * Google" free/no-quota behavior. The one real difference: a wider range
   * does not mean more history here. `archive()`'s daily totals accumulate
   * forever; hourly detail only ever covers Google's own hourly lookback
   * (roughly the trailing 8-10 days), because that is all the nightly sync
   * ever has to fetch. A `startDate` earlier than that window returns nothing
   * for the days outside it, not an error.
   *
   * Each row's `hour` is 0-23 in Search Console's own America/Los_Angeles
   * reporting hour. A pure read despite the POST, so `{ idempotent: true }`
   * is safe if you want it retried.
   *
   * Check `ok` first: a project with no connected property answers 200 with
   * `{ ok: false, reason, connectUrl }` and no rows.
   */
  hourly(
    input: GscHourlyInput,
    options?: RequestOptions,
  ): Promise<GscHourlyResponse> {
    return this.http.post<GscHourlyResponse>("/gsc/hourly", input, options);
  }

  /**
   * MisarSEO's own index-coverage report: which URLs are indexed, excluded,
   * or errored, and why. Free, and — like `archive()` — makes no call to
   * Google; it reads `gscUrlCoverage`, populated by a nightly scan built on
   * the URL Inspection API's ~2000/day quota, so coverage fills in over days
   * rather than in one pass.
   *
   * `summary` is the headline count per state. `rows` is one page (default
   * 200, max 1000) of the URLs themselves, newest-inspected first — filter to
   * one state with `coverageState`.
   *
   * Check `ok` first: a project with no connected property answers 200 with
   * `{ ok: false, reason, connectUrl }`. `ok: true` with an empty
   * `summary`/`rows` means the nightly scan has not populated this property
   * yet, not that every page is fine.
   */
  coverage(
    input: GscCoverageInput,
    options?: RequestOptions,
  ): Promise<GscCoverageResponse> {
    return this.http.post<GscCoverageResponse>("/gsc/coverage", input, options);
  }

  /**
   * Run Google Search Console's URL Inspection on up to 10 URLs.
   * Returns index/coverage state, last crawl time, canonical, and
   * mobile/rich-results verdicts.
   */
  inspectUrls(
    input: InspectUrlsInput,
    options?: RequestOptions,
  ): Promise<InspectUrlsResponse> {
    return this.http.post<InspectUrlsResponse>(
      "/gsc/inspect-urls",
      input,
      options,
    );
  }

  /**
   * Search Console `sitemaps.list`/`sitemaps.get` (GAP-060): every submitted
   * sitemap for the connected property and its processing status, or one
   * named sitemap.
   *
   * Read-only — needs only the `webmasters.readonly` scope this SDK's OAuth
   * connection already requests. Submit/delete need the broader `webmasters`
   * scope and are not offered.
   *
   * Omit `feedpath` to list every sitemap; pass one (a sitemap's own URL,
   * e.g. another entry's own `path`) to fetch just that one instead. Either
   * way the response is `sitemaps: GscSitemap[]` — a one-entry array for
   * `feedpath` — so narrow on `report.state` exactly once regardless of
   * which Google method ran.
   *
   * Charges no credits but spends one call of Google's per-property quota.
   * 404s when `feedpath` names a sitemap Google has no record of.
   */
  sitemaps(
    input: GscSitemapsInput,
    options?: RequestOptions,
  ): Promise<GscSitemapsReport> {
    return this.http.post<GscSitemapsReport>("/gsc/sitemaps", input, options);
  }

  /**
   * Find queries where the connected property competes with itself — two or more
   * of its own pages drawing impressions for the same query.
   *
   * Charges no credits (Search Console meters none), but one report issues
   * several large `searchAnalytics.query` requests against Google's per-property
   * quota, so it is rate limited more tightly than `performance`.
   *
   * A pure read despite the POST, so `{ idempotent: true }` is safe if you want
   * it retried like a GET.
   *
   * ALWAYS narrow on `report.state` first. The four states are four different
   * facts: `not_connected`, `requires_reconnect`, `no_search_data`, and
   * `analysed` (where `findings: []` means "we looked and found none" — the
   * `coverage` block is the proof). Treating any of the first three as an empty
   * finding list reports "no cannibalisation" where the truth is "no data".
   */
  cannibalisation(
    input: CannibalisationInput,
    options?: RequestOptions,
  ): Promise<CannibalisationReport> {
    return this.http.post<CannibalisationReport>(
      "/gsc/cannibalisation",
      input,
      options,
    );
  }

  /**
   * Pages whose clicks declined by a meaningful amount between two adjacent
   * windows, read entirely from MisarSEO's own archived Search Console
   * history. Makes NO live Google call — charges no credits and spends no
   * Search Console quota — so this is rate limited only against ordinary
   * abuse, not upstream cost.
   *
   * `window` selects the RECENT period length; the EARLIER period compared
   * against it is the same length immediately before it (period-over-period,
   * not a calendar-month split).
   *
   * ALWAYS narrow on `report.state` first. `not_connected` and
   * `insufficient_history` are both absences of data, never a clean bill of
   * health — `insufficient_history` fires when either comparison window has
   * no archived rows at all. `analysed` may legitimately have `findings: []`;
   * `coverage` is the proof of how much was actually read.
   */
  contentDecay(
    input: ContentDecayInput,
    options?: RequestOptions,
  ): Promise<ContentDecayReport> {
    return this.http.post<ContentDecayReport>(
      "/gsc/content-decay",
      input,
      options,
    );
  }

  /**
   * CTR by ranking position (GAP-073 remainder): the site's own historical
   * clicks/impressions bucketed by position (1-3, 4-10, 11-20, 21+ —
   * mirroring GAP-103's rank-tracking position-distribution buckets), with
   * the REAL clicks-weighted CTR this project achieved at each bucket. Never
   * a fabricated industry-average curve — every number comes from this
   * project's own archived Search Console history.
   *
   * Free and makes NO live Search Console call: reads only MisarSEO's own
   * archive (`gsc_dimension_metrics`), the same one `contentDecay()` reads.
   *
   * ALWAYS narrow on `report.state` first. `not_connected` and `no_data` are
   * both absences of data, never a clean bill of health — `no_data` means the
   * archive has no rows at all for this dimension/window, not zero traffic.
   */
  ctrByPosition(
    input: CtrByPositionInput,
    options?: RequestOptions,
  ): Promise<CtrByPositionReport> {
    return this.http.post<CtrByPositionReport>(
      "/gsc/ctr-by-position",
      input,
      options,
    );
  }

  /**
   * Anonymized-query estimate (GAP-073 remainder): the gap between the
   * property's TRUE total clicks/impressions (an undimensioned
   * `searchAnalytics.query` call) and the SUM of every named query row
   * Search Console returned for the same window (a `dimensions: ["query"]`
   * call) — Search Console omits some rare queries entirely from the latter
   * to protect searcher privacy, and this is the real, derived size of that
   * gap, not a guess at Google's undisclosed threshold.
   *
   * Charges no credits, but spends TWO Search Console requests of Google's
   * per-property quota per call.
   *
   * ALWAYS narrow on `report.state` first, and on `analysed`, ALWAYS check
   * `possiblyRowCapped` before presenting the estimate: when true, the
   * named-query fetch hit its 1,000-row cap, so part of the gap is queries
   * this call did not reach, not privacy anonymization.
   */
  anonymousQueries(
    input: AnonymousQueriesInput,
    options?: RequestOptions,
  ): Promise<AnonymousQueriesReport> {
    return this.http.post<AnonymousQueriesReport>(
      "/gsc/anonymous-queries",
      input,
      options,
    );
  }
}
