import { HttpClient } from "./http.js";
import { AccountResource } from "./resources/account.js";
import { ActivityResource } from "./resources/activity.js";
import { AiSearchResource } from "./resources/ai-search.js";
import { BacklinksResource } from "./resources/backlinks.js";
import { BingResource } from "./resources/bing.js";
import { CompetitorsResource } from "./resources/competitors.js";
import { CrawlResource } from "./resources/crawl.js";
import { DomainResource } from "./resources/domain.js";
import { GscResource } from "./resources/gsc.js";
import { IndexNowResource } from "./resources/indexnow.js";
import { KeywordsResource } from "./resources/keywords.js";
import { LocalResource } from "./resources/local.js";
import { LogAnalyzerResource } from "./resources/log-analyzer.js";
import { PatchesResource } from "./resources/patches.js";
import { ProjectsResource } from "./resources/projects.js";
import { RankTrackingResource } from "./resources/rank-tracking.js";
import { YandexResource } from "./resources/yandex.js";

export interface MisarSeoClientConfig {
  /** MisarSEO API key — passed as `Authorization: Bearer <apiKey>` */
  apiKey: string;
  /**
   * Base URL for the MisarSEO REST API.
   * @default "https://api.misar.io/seo"
   */
  baseUrl?: string;
  /**
   * Per-request deadline in milliseconds; `0` disables it. Overridable per
   * call via the trailing `options` argument on any resource method.
   * @default 30000
   */
  timeoutMs?: number;
  /**
   * Extra attempts after the first for retryable failures — network errors,
   * 502/503/504, and 429. `0` disables retrying. See `retry.ts` for the exact
   * policy and which methods it applies to.
   * @default 2
   */
  maxRetries?: number;
  /**
   * First backoff step between retries; doubles per attempt, with jitter.
   * @default 250
   */
  retryBaseDelayMs?: number;
  /**
   * Ceiling on any single wait, including one the server asked for via
   * `Retry-After`. A longer `Retry-After` raises `MisarSeoRateLimitError`
   * immediately instead of parking the caller.
   * @default 60000
   */
  maxRetryDelayMs?: number;
}

const DEFAULT_BASE_URL = "https://api.misar.io/seo";

/**
 * MisarSEO TypeScript SDK client.
 *
 * @example
 * ```typescript
 * import { MisarSeoClient } from "@misar/seo";
 *
 * const client = new MisarSeoClient({ apiKey: process.env.MISARSEO_API_KEY! });
 *
 * const { projects } = await client.projects.list();
 * const overview = await client.domain.overview({ projectId: projects[0].id, domain: "example.com" });
 * ```
 */
export class MisarSeoClient {
  private readonly http: HttpClient;

  /** List and inspect projects */
  readonly projects: ProjectsResource;

  /** Site crawl / audit */
  readonly crawl: CrawlResource;

  /** Keyword research, saved keywords */
  readonly keywords: KeywordsResource;

  /** Rank tracker configs and position snapshots */
  readonly rankTracking: RankTrackingResource;

  /** Domain organic overview */
  readonly domain: DomainResource;

  /** Backlink profiles */
  readonly backlinks: BacklinksResource;

  /** SERP competitor discovery */
  readonly competitors: CompetitorsResource;

  /** Local business listings + Google Business Q&A */
  readonly local: LocalResource;

  /** Google Search Console performance + URL inspection */
  readonly gsc: GscResource;

  /** AI search brand visibility (Brand Lookup + Prompt Explorer) */
  readonly aiSearch: AiSearchResource;

  /** Data Subject Rights: account data export and erasure */
  readonly account: AccountResource;

  /** Tenant activity log (admin-only) */
  readonly activity: ActivityResource;

  /** IndexNow URL submission (Bing/Yandex/Seznam/Naver) */
  readonly indexNow: IndexNowResource;

  /** Bing's own view of a project's domain (search performance, own-site backlinks) */
  readonly bing: BingResource;

  /** Yandex's own view of a project's domain (SQI, indexing summary, popular queries) */
  readonly yandex: YandexResource;

  /** AI-drafted or hand-edited title/meta/canonical patches, reviewed before going live */
  readonly patches: PatchesResource;

  /** Log File Analyzer / Bot Analytics — upload a server access log, read back its bot-traffic report */
  readonly logAnalyzer: LogAnalyzerResource;

  constructor(config: MisarSeoClientConfig) {
    this.http = new HttpClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      maxRetryDelayMs: config.maxRetryDelayMs,
    });

    this.projects = new ProjectsResource(this.http);
    this.crawl = new CrawlResource(this.http);
    this.keywords = new KeywordsResource(this.http);
    this.rankTracking = new RankTrackingResource(this.http);
    this.domain = new DomainResource(this.http);
    this.backlinks = new BacklinksResource(this.http);
    this.competitors = new CompetitorsResource(this.http);
    this.local = new LocalResource(this.http);
    this.gsc = new GscResource(this.http);
    this.aiSearch = new AiSearchResource(this.http);
    this.account = new AccountResource(this.http);
    this.activity = new ActivityResource(this.http);
    this.indexNow = new IndexNowResource(this.http);
    this.bing = new BingResource(this.http);
    this.yandex = new YandexResource(this.http);
    this.patches = new PatchesResource(this.http);
    this.logAnalyzer = new LogAnalyzerResource(this.http);
  }
}
