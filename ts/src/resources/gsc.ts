import type { HttpClient, RequestOptions } from "../http.js";
import type {
  CannibalisationInput,
  CannibalisationReport,
  GscArchiveInput,
  GscArchiveResponse,
  GscCoverageInput,
  GscCoverageResponse,
  GscPerformanceInput,
  GscMetrics,
  GscConnectionStatusInput,
  GscConnectionStatusResponse,
  InspectUrlsInput,
  InspectUrlsResponse,
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
}
