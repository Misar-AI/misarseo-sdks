import type { HttpClient, RequestOptions } from "../http.js";
import type {
  ContentOptimizerInput,
  ContentOptimizerResult,
  PageMetricsInput,
  PageMetricsResult,
} from "../types.js";

/**
 * Content resource — on-page optimization and AI content grading.
 * New namespace (not folded into `keywords`): a new product surface this
 * codebase talks to, not a new method on an existing one.
 */
export class ContentResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * On-page recommendations and an AI content grade for one page,
   * benchmarked against the pages currently ranking for its target keyword
   * (GAP-134 + GAP-137(a), built together — one AI-gateway call produces
   * both the grade and the recommendations).
   *
   * CHARGES ONE AI-gateway operation against the organization's shared
   * monthly ceiling — not a plan-quota dimension of its own. The page crawl
   * (target + up to 5 competitors) and the SERP fetch are both free.
   *
   * `url` does not have to belong to the calling project's own domain or to
   * a page a site audit has crawled — any http(s) URL is graded fresh.
   *
   * ALWAYS narrow on `result.state` first. `target_unreachable` means the
   * target page itself could not be fetched — an ordinary outcome for a URL
   * check, never a thrown error. On `analysed`, check
   * `coverage.serpUnavailable` / `competitorsCrawled` before trusting the
   * competitor comparison: a low or zero count means the grade is based on
   * the target page and general on-page practice alone.
   *
   * `grade` is an AI-generated qualitative read of the measured signals in
   * `target`/`competitors`, not a calibrated industry score.
   *
   * Does NOT detect AI-written content — that half of GAP-137 is not built;
   * see the gap register's GAP-137 row for why.
   */
  optimizer(
    input: ContentOptimizerInput,
    options?: RequestOptions,
  ): Promise<ContentOptimizerResult> {
    return this.http.post<ContentOptimizerResult>(
      "/content/optimizer",
      input,
      options,
    );
  }

  /**
   * Lightweight on-page metrics for one arbitrary URL (GAP-196) — the
   * content optimizer's keyword-free, AI-free sibling. Built for callers
   * that just want title/meta/heading/word-count signals for a page (e.g.
   * the browser extension's on-page panel checking whatever page the user
   * is currently viewing), with none of `optimizer()`'s cost: no keyword
   * required, no AI-gateway charge, no competitor crawl or SERP fetch.
   *
   * `url` does not have to belong to the calling project's own domain.
   * ALWAYS narrow on `result.state` first — `unreachable` means the page
   * itself could not be fetched, an ordinary outcome for an arbitrary URL
   * check, never a thrown error.
   */
  pageMetrics(
    input: PageMetricsInput,
    options?: RequestOptions,
  ): Promise<PageMetricsResult> {
    return this.http.post<PageMetricsResult>(
      "/content/page-metrics",
      input,
      options,
    );
  }
}
