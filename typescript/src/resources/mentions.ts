import type { HttpClient, RequestOptions } from "../http.js";
import type {
  MediaMonitoringInput,
  MediaMonitoringResult,
  UnlinkedMentionsInput,
  UnlinkedMentionsResult,
} from "../types.js";

/**
 * Mentions resource — Unlinked Brand Mentions (GAP-131) and their Media
 * Monitoring composition (GAP-183). New namespace (not folded into
 * `content` or `aiSearch`): a new product surface this codebase talks to,
 * not a new method on an existing one.
 */
export class MentionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Unlinked brand mentions (GAP-131): searches the free SERP backend for
   * `brand` as a QUERY (never fetched as a URL), then checks whether each
   * result page already links to `trackedDomain`.
   *
   * Free: one SERP fetch plus up to 10 live third-party page fetches, no
   * AI-gateway spend.
   *
   * ALWAYS narrow on `result.state` first. `serp_unavailable` means no free
   * SERP provider could be reached — never treat it as "zero mentions
   * found". On `analysed`, each `candidates[]` entry carries
   * `status: "linked" | "unlinked" | "unreachable"`.
   *
   * Bounded by SERP result count — the first page or two of free-SERP
   * results for the brand, never an exhaustive web crawl or a full content
   * index. The Common Crawl-based version of this gap (GAP-130) is a
   * decided wont-fix; `result.scopeNote` states this bound on every
   * `analysed` response.
   */
  unlinkedMentions(
    input: UnlinkedMentionsInput,
    options?: RequestOptions,
  ): Promise<UnlinkedMentionsResult> {
    return this.http.post<UnlinkedMentionsResult>(
      "/mentions/unlinked",
      input,
      options,
    );
  }

  /**
   * Media Monitoring (GAP-183): `unlinkedMentions()`'s results filtered to
   * domains classified as a known social/forum/news platform (YouTube,
   * TikTok, Reddit, Wikipedia, LinkedIn, Quora), optionally merged with the
   * per-platform citation breakdown from a Prompt Explorer scan you already
   * ran for the same brand (pass its `citations`, mapped to
   * `{url, domain}`, as `input.citations`).
   *
   * Same cost profile as `unlinkedMentions()`, which this calls internally
   * — no AI-gateway spend, even when `citations` is supplied (that data is
   * only classified here, never fetched).
   *
   * NOT a real-time media-monitoring product: no social-platform API
   * polling, no forum-API crawling, no news-aggregator feed —
   * `result.scopeNote` states this on every `analysed` response.
   *
   * ALWAYS narrow on `result.state` first, same as `unlinkedMentions()`.
   * `result.aiCitationPlatforms === null` means no `citations` were
   * supplied — distinct from an empty array, which would mean a scan cited
   * nothing on a known platform.
   */
  mediaMonitoring(
    input: MediaMonitoringInput,
    options?: RequestOptions,
  ): Promise<MediaMonitoringResult> {
    return this.http.post<MediaMonitoringResult>(
      "/mentions/media-monitoring",
      input,
      options,
    );
  }
}
