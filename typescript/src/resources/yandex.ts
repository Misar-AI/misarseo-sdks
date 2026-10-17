import type { HttpClient, RequestOptions } from "../http.js";
import type {
  YandexSiteOverviewInput,
  YandexSiteOverviewResponse,
  YandexReindexUrlInput,
  YandexReindexUrlResponse,
  YandexConnectionStatusInput,
  YandexConnectionStatusResponse,
  YandexListHostsInput,
  YandexListHostsResponse,
  YandexSetHostInput,
  YandexConnection,
  YandexDisconnectInput,
} from "../types.js";

/**
 * Yandex Webmaster resource — Yandex's own view of a project's domain.
 *
 * Two coexisting credential paths (GAP-040 reopened), in priority order:
 * a per-project OAuth "Connect" grant (`connect()`/`listHosts()`/
 * `setHost()`/`disconnect()` below) when one exists, falling back to the
 * deployment operator's `YANDEX_WEBMASTER_OAUTH_TOKEN` otherwise. Every
 * report method below (siteOverview, reindexUrl) transparently uses
 * whichever credential the project has.
 */
export class YandexResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the Yandex Webmaster connection status for a project: whether the
   * caller has a Yandex OAuth grant at all, and which host (if any) is
   * connected. NOT the OAuth entry point — see `BingResource.connect()`'s
   * own doc comment for why.
   */
  connect(
    input: YandexConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<YandexConnectionStatusResponse> {
    return this.http.get<YandexConnectionStatusResponse>(
      "/yandex/connection",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Every host the caller's connected Yandex Webmaster account can access —
   * the picker's data source. Check `requiresReconnect` first: `true` (with
   * an empty `hosts` list) means the stored grant can no longer reach
   * Yandex Webmaster.
   */
  listHosts(
    input: YandexListHostsInput,
    options?: RequestOptions,
  ): Promise<YandexListHostsResponse> {
    return this.http.get<YandexListHostsResponse>(
      "/yandex/hosts",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Link (or repoint) the project's Yandex Webmaster host. `hostId` is
   * re-validated against the caller's LIVE host list on every call.
   */
  setHost(
    input: YandexSetHostInput,
    options?: RequestOptions,
  ): Promise<{ connection: YandexConnection }> {
    return this.http.post<{ connection: YandexConnection }>(
      "/yandex/connection",
      input,
      options,
    );
  }

  /**
   * Remove the project's Yandex Webmaster link. Requires at least the admin
   * role.
   */
  disconnect(
    input: YandexDisconnectInput,
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/yandex/connection", input, options);
  }

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

  /**
   * Ask Yandex to re-crawl one specific URL on the project's matched host
   * (GAP-045a). A MUTATION, unlike `siteOverview`: it queues real work on
   * the operator's live Yandex Webmaster account and spends that account's
   * daily recrawl quota.
   */
  reindexUrl(
    input: YandexReindexUrlInput,
    options?: RequestOptions,
  ): Promise<YandexReindexUrlResponse> {
    return this.http.post<YandexReindexUrlResponse>(
      "/yandex/reindex-url",
      input,
      options,
    );
  }
}
