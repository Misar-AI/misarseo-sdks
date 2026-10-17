import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BingSiteOverviewInput,
  BingSiteOverviewResponse,
  BingBacklinksInput,
  BingBacklinksResponse,
  BingUrlLinksInput,
  BingUrlLinksResponse,
  BingUrlInfoInput,
  BingUrlInfoResponse,
  BingKeywordResearchInput,
  BingKeywordResearchResponse,
  BingSubmitFeedInput,
  BingSubmitFeedResponse,
  BingSubmitContentInput,
  BingSubmitContentResponse,
  BingFeedDetailsInput,
  BingFeedDetailsResponse,
  BingDetailStatsInput,
  BingDetailStatsResponse,
  BingSaveCrawlSettingsInput,
  BingSaveCrawlSettingsResponse,
  BingQueryParameterMutationInput,
  BingQueryParameterMutationResponse,
  BingBlockedUrlMutationInput,
  BingBlockedUrlMutationResponse,
  BingConnectionStatusInput,
  BingConnectionStatusResponse,
  BingListSitesInput,
  BingListSitesResponse,
  BingSetSiteInput,
  BingConnection,
  BingDisconnectInput,
} from "../types.js";

/**
 * Bing Webmaster resource — Bing's own view of a project's domain.
 *
 * Two coexisting credential paths (GAP-030 reopened), in priority order:
 * a per-project OAuth "Connect" grant (`connect()`/`listSites()`/
 * `setSite()`/`disconnect()` below — a user's own Bing account, one site
 * bound per project) when one exists, falling back to the deployment
 * operator's `BING_WEBMASTER_API_KEY` (one key covering every site verified
 * on that Bing account) otherwise. Every report method below (siteOverview,
 * backlinks, urlLinks, …) transparently uses whichever credential the
 * project has — there is no separate method per credential type.
 */
export class BingResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the Bing Webmaster connection status for a project: whether the
   * caller has a Bing OAuth grant at all, and which site (if any) is
   * connected.
   *
   * NOT the OAuth entry point — this starts no authorization flow. Bing's
   * own consent screen and redirect are a browser-only flow the web app
   * drives; there is no SDK method that starts it (an API-key caller has no
   * browser to send the user through Bing's consent screen).
   */
  connect(
    input: BingConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<BingConnectionStatusResponse> {
    return this.http.get<BingConnectionStatusResponse>(
      "/bing/connection",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Every site the caller's connected Bing Webmaster account can access —
   * the picker's data source. A live call to the Bing Webmaster API
   * (GetUserSites) under the caller's OWN OAuth token, not the operator key.
   *
   * Check `requiresReconnect` first: `true` (with an empty `sites` list)
   * means the stored grant can no longer reach Bing Webmaster.
   */
  listSites(
    input: BingListSitesInput,
    options?: RequestOptions,
  ): Promise<BingListSitesResponse> {
    return this.http.get<BingListSitesResponse>(
      "/bing/sites",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Link (or repoint) the project's Bing Webmaster site. `siteUrl` is
   * re-validated against the caller's LIVE site list on every call — it can
   * 404 if the site fell out of the connected account's access since it was
   * last listed via `listSites()`.
   */
  setSite(
    input: BingSetSiteInput,
    options?: RequestOptions,
  ): Promise<{ connection: BingConnection }> {
    return this.http.post<{ connection: BingConnection }>(
      "/bing/connection",
      input,
      options,
    );
  }

  /**
   * Remove the project's Bing Webmaster link. Requires at least the admin
   * role — disconnecting breaks Bing Webmaster data for every member, not
   * just the caller.
   */
  disconnect(
    input: BingDisconnectInput,
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/bing/connection", input, options);
  }

  /**
   * Search performance (daily rank/traffic + per-query stats), own-site
   * inbound links, and remaining URL Submission quota, all in one call.
   *
   * Check `ok` first: a deployment with no key, or a project whose domain
   * has no verified match on the Bing account, answers 200 with
   * `{ ok: false, reason }`. When `ok` is true, each of `rankAndTraffic` /
   * `queryStats` / `backlinks` / `submissionQuota` can still be `null` on
   * its own — with the reason in `errors` — because one Bing endpoint
   * failing does not blank the others.
   */
  siteOverview(
    input: BingSiteOverviewInput,
    options?: RequestOptions,
  ): Promise<BingSiteOverviewResponse> {
    return this.http.post<BingSiteOverviewResponse>(
      "/bing/site-overview",
      input,
      options,
    );
  }

  /**
   * GetLinkCounts (GAP-032/GAP-080): own-site inbound-link page list for the
   * project's matched Bing site — the focused, single-call form of the
   * `backlinks` field already embedded in `siteOverview()`. Own-site only —
   * Bing exposes no competitor/any-domain backlink lookup.
   */
  backlinks(
    input: BingBacklinksInput,
    options?: RequestOptions,
  ): Promise<BingBacklinksResponse> {
    return this.http.post<BingBacklinksResponse>(
      "/bing/backlinks",
      input,
      options,
    );
  }

  /**
   * GetUrlLinks (GAP-032): inbound links (anchor text + source URL)
   * pointing at one specific page on the project's matched Bing site.
   * Own-site only — Bing exposes no competitor/any-domain backlink lookup.
   */
  urlLinks(
    input: BingUrlLinksInput,
    options?: RequestOptions,
  ): Promise<BingUrlLinksResponse> {
    return this.http.post<BingUrlLinksResponse>(
      "/bing/url-links",
      input,
      options,
    );
  }

  /**
   * GetUrlInfo + optionally GetChildrenUrlInfo (GAP-034): index/crawl
   * metadata for one URL on the project's matched Bing site, and, when
   * `includeChildren` is set, the same metadata for its discovered
   * children.
   */
  urlInfo(
    input: BingUrlInfoInput,
    options?: RequestOptions,
  ): Promise<BingUrlInfoResponse> {
    return this.http.post<BingUrlInfoResponse>(
      "/bing/url-info",
      input,
      options,
    );
  }

  /**
   * GetKeyword + GetKeywordStats + GetRelatedKeywords (GAP-033): real Bing
   * impression data for a query, its recent weekly history, and related
   * queries.
   */
  keywordResearch(
    input: BingKeywordResearchInput,
    options?: RequestOptions,
  ): Promise<BingKeywordResearchResponse> {
    return this.http.post<BingKeywordResearchResponse>(
      "/bing/keyword-research",
      input,
      options,
    );
  }

  /**
   * SubmitFeed (GAP-035 remainder): submits a sitemap/feed URL to Bing for
   * the project's matched site. A MUTATION, unlike every other method on
   * this resource.
   */
  submitFeed(
    input: BingSubmitFeedInput,
    options?: RequestOptions,
  ): Promise<BingSubmitFeedResponse> {
    return this.http.post<BingSubmitFeedResponse>(
      "/bing/submit-feed",
      input,
      options,
    );
  }

  /**
   * SubmitContent (GAP-035 remainder): pushes a page's full content
   * (base64-encoded HTTP message) directly to Bing for the project's
   * matched site, bypassing a crawl. A MUTATION, unlike every other method
   * on this resource.
   */
  submitContent(
    input: BingSubmitContentInput,
    options?: RequestOptions,
  ): Promise<BingSubmitContentResponse> {
    return this.http.post<BingSubmitContentResponse>(
      "/bing/submit-content",
      input,
      options,
    );
  }

  /**
   * GetFeedDetails (GAP-035 remainder): the same `Feed` shape as one
   * `GetFeeds` entry, for one specific feed URL on the project's matched
   * Bing site.
   */
  getFeedDetails(
    input: BingFeedDetailsInput,
    options?: RequestOptions,
  ): Promise<BingFeedDetailsResponse> {
    return this.http.post<BingFeedDetailsResponse>(
      "/bing/feed-details",
      input,
      options,
    );
  }

  /**
   * GetQueryTrafficStats + GetPageStats + GetPageQueryStats +
   * GetQueryPageStats + GetQueryPageDetailStats (GAP-031 remainder):
   * per-query and per-page search-performance detail. `pageStats` is always
   * attempted; the other four sections are `null` unless their required
   * `query`/`pageUrl` argument was supplied — see each field's own doc
   * comment on `BingDetailStatsResponse`.
   */
  detailStats(
    input: BingDetailStatsInput,
    options?: RequestOptions,
  ): Promise<BingDetailStatsResponse> {
    return this.http.post<BingDetailStatsResponse>(
      "/bing/detail-stats",
      input,
      options,
    );
  }

  /**
   * SaveCrawlSettings (GAP-034 remainder): overwrites the project's matched
   * Bing site's crawl-rate/AJAX-crawling config. A MUTATION.
   */
  saveCrawlSettings(
    input: BingSaveCrawlSettingsInput,
    options?: RequestOptions,
  ): Promise<BingSaveCrawlSettingsResponse> {
    return this.http.post<BingSaveCrawlSettingsResponse>(
      "/bing/crawl-settings",
      input,
      options,
    );
  }

  /**
   * AddQueryParameter + RemoveQueryParameter + EnableDisableQueryParameter
   * (GAP-036): add, remove, or toggle one query-string parameter Bing is
   * told to ignore when canonicalizing URLs. A MUTATION.
   */
  updateQueryParameter(
    input: BingQueryParameterMutationInput,
    options?: RequestOptions,
  ): Promise<BingQueryParameterMutationResponse> {
    return this.http.post<BingQueryParameterMutationResponse>(
      "/bing/query-parameters",
      input,
      options,
    );
  }

  /**
   * AddBlockedUrl + RemoveBlockedUrl (GAP-036): tell Bing to stop, or
   * resume, showing one URL in search results. A MUTATION.
   */
  updateBlockedUrl(
    input: BingBlockedUrlMutationInput,
    options?: RequestOptions,
  ): Promise<BingBlockedUrlMutationResponse> {
    return this.http.post<BingBlockedUrlMutationResponse>(
      "/bing/blocked-urls",
      input,
      options,
    );
  }
}
