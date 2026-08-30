import type { HttpClient, RequestOptions } from "../http.js";
import type { IndexNowSubmitInput, IndexNowSubmitResponse } from "../types.js";

/**
 * IndexNow resource — manual URL submission to the shared IndexNow relay
 * (Bing, Yandex, Seznam, Naver). Free, no OAuth. Requires the project to have
 * an `indexNowKey` set (`PATCH /api/seo/projects/:projectId`); see
 * `docs/reference/misarseo-gap-register.md` GAP-050.
 *
 * This is the on-demand path. The primary path is automatic: every completed
 * crawl submits its own crawled URLs on its own, with no client call needed.
 */
export class IndexNowResource {
  constructor(private readonly http: HttpClient) {}

  /** Submit up to 10,000 URLs on the project's own domain. */
  submit(
    input: IndexNowSubmitInput,
    options?: RequestOptions,
  ): Promise<IndexNowSubmitResponse> {
    return this.http.post<IndexNowSubmitResponse>(
      "/indexnow/submit",
      input,
      options,
    );
  }
}
