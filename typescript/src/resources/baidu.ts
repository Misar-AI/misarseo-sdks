import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BaiduConnectionStatusInput,
  BaiduConnectionStatusResponse,
  BaiduSetConnectionInput,
  BaiduConnectionInfo,
  BaiduDisconnectInput,
  BaiduSubmitUrlsInput,
  BaiduSubmitUrlsResponse,
} from "../types.js";

/**
 * Baidu Webmaster (百度搜索资源平台 / Baidu Ziyuan) resource — the
 * data.zz.baidu.com/urls push API, an independent search index with its own
 * crawler (Baiduspider).
 *
 * Bring-your-own-token, PER PROJECT — unlike `bing`/`yandex`, there is no
 * operator-wide env var and no OAuth "Connect" flow: Baidu mints a push
 * token per SITE (not per account) on ziyuan.baidu.com, only after the
 * operator/user completes Baidu's own site-ownership verification there —
 * a real, external, one-time setup step this SDK cannot automate. See
 * `src/server/lib/baidu-webmaster/client.ts`'s own docblock for the full
 * research trail behind this shape.
 */
export class BaiduResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * The project's current Baidu connection, plus today's push-quota usage.
   * `today.lastRemain` is Baidu's own authoritative number as of the last
   * push (null until the first push of the day) — `today.assumedDailyQuota`
   * is a courtesy default only, never a real ceiling.
   */
  connection(
    input: BaiduConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<BaiduConnectionStatusResponse> {
    return this.http.get<BaiduConnectionStatusResponse>(
      "/baidu/connection",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Set (or replace) the project's Baidu site + push token. Baidu exposes
   * no API to list or verify sites on an account, unlike Bing's
   * `GetUserSites` — this stores the pair as given, with no live
   * re-validation against Baidu.
   */
  setConnection(
    input: BaiduSetConnectionInput,
    options?: RequestOptions,
  ): Promise<{ connection: BaiduConnectionInfo }> {
    return this.http.post<{ connection: BaiduConnectionInfo }>(
      "/baidu/connection",
      input,
      options,
    );
  }

  /**
   * Remove the project's Baidu connection. Requires at least the admin
   * role — disconnecting breaks Baidu push submission for every member,
   * not just the caller.
   */
  disconnect(
    input: BaiduDisconnectInput,
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/baidu/connection", input, options);
  }

  /**
   * Push up to `BAIDU_MAX_URLS_PER_REQUEST` (2000) of a project's own URLs
   * to Baidu for expedited crawling. Check `ok` first: no connection, an
   * already-exhausted daily quota, or an unverified site all answer 200
   * with `{ ok: false, reason }` rather than throwing — expected
   * operational states, not errors.
   */
  submitUrls(
    input: BaiduSubmitUrlsInput,
    options?: RequestOptions,
  ): Promise<BaiduSubmitUrlsResponse> {
    return this.http.post<BaiduSubmitUrlsResponse>(
      "/baidu/submit",
      input,
      options,
    );
  }
}
