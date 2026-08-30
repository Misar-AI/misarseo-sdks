import type { HttpClient, RequestOptions } from "../http.js";
import type {
  YandexSiteOverviewInput,
  YandexSiteOverviewResponse,
} from "../types.js";

/**
 * Yandex Webmaster resource — Yandex's own view of a project's domain. Free,
 * no OAuth flow driven by MisarSEO: the deployment operator generates a
 * Yandex OAuth token once (via a Yandex OAuth app they register themselves)
 * and sets `YANDEX_WEBMASTER_OAUTH_TOKEN`; it covers every host verified on
 * that Yandex account.
 */
export class YandexResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * The indexing summary — including the Site Quality Index (SQI), a third
   * independent authority signal alongside OpenPageRank and Tranco — and
   * popular search queries, in one call.
   *
   * Check `ok` first: a deployment with no token, or a project whose domain
   * has no verified match on the Yandex account, answers 200 with
   * `{ ok: false, reason }`. When `ok` is true, `summary` and
   * `popularQueries` can still each be `null` on their own — with the reason
   * in `errors` — because one Yandex endpoint failing does not blank the
   * other.
   *
   * Yandex publishes no backlink-lookup endpoint at all, so unlike its Bing
   * sibling this response has no backlinks section.
   */
  siteOverview(
    input: YandexSiteOverviewInput,
    options?: RequestOptions,
  ): Promise<YandexSiteOverviewResponse> {
    return this.http.post<YandexSiteOverviewResponse>(
      "/yandex/site-overview",
      input,
      options,
    );
  }
}
