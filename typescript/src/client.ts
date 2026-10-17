import { HttpClient } from "./http.js";
import { AccountResource } from "./resources/account.js";
import { ActivityResource } from "./resources/activity.js";
import { AhrefsResource } from "./resources/ahrefs.js";
import { AiSearchResource } from "./resources/ai-search.js";
import { BacklinksResource } from "./resources/backlinks.js";
import { BaiduResource } from "./resources/baidu.js";
import { BingResource } from "./resources/bing.js";
import { BraveSearchResource } from "./resources/brave-search.js";
import { CompetitorsResource } from "./resources/competitors.js";
import { CompetitorMonitorResource } from "./resources/competitor-monitor.js";
import { ContentResource } from "./resources/content.js";
import { CrawlResource } from "./resources/crawl.js";
import { DashboardResource } from "./resources/dashboard.js";
import { DirectVendorAiResource } from "./resources/direct-vendor-ai.js";
import { DisavowResource } from "./resources/disavow.js";
import { DomainResource } from "./resources/domain.js";
import { GoogleBusinessProfileResource } from "./resources/google-business-profile.js";
import { LinkBuildingResource } from "./resources/link-building.js";
import { LocalRankGridResource } from "./resources/local-rank-grid.js";
import { LocalPackRankResource } from "./resources/local-pack-rank.js";
import { MentionsResource } from "./resources/mentions.js";
import { PortfoliosResource } from "./resources/portfolios.js";
import { ReportBuilderResource } from "./resources/report-builder.js";
import { GscResource } from "./resources/gsc.js";
import { Ga4Resource } from "./resources/ga4.js";
import { IndexNowResource } from "./resources/indexnow.js";
import { KeywordsResource } from "./resources/keywords.js";
import { LocalResource } from "./resources/local.js";
import { LogAnalyzerResource } from "./resources/log-analyzer.js";
import { PatchesResource } from "./resources/patches.js";
import { ProjectsResource } from "./resources/projects.js";
import { RankTrackingResource } from "./resources/rank-tracking.js";
import { UsageResource } from "./resources/usage.js";
import { WebAnalyticsResource } from "./resources/web-analytics.js";
import { YandexResource } from "./resources/yandex.js";
import { TeamResource } from "./resources/team.js";

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
 * import { MisarSeoClient } from "@misarseo/sdk";
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

  /** Google Analytics (GA4) connection + performance */
  readonly ga4: Ga4Resource;

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

  /**
   * Ahrefs Connect (GAP-207) — per-project OAuth "Connect" flow for Ahrefs'
   * Rank Tracker and Site Audit projects. CODE-COMPLETE BUT INERT: hidden/
   * disabled on every deployment until a human completes the Ahrefs Connect
   * partner application — see
   * docs/reference/ahrefs-connect-application-checklist.md.
   */
  readonly ahrefs: AhrefsResource;

  /** Yandex's own view of a project's domain (SQI, indexing summary, popular queries) */
  readonly yandex: YandexResource;

  /** Brave Search API (GAP-204) — real rank checks against Brave's own independent index. Bring-your-own-key (BRAVE_SEARCH_API_KEY), paid per query. */
  readonly braveSearch: BraveSearchResource;

  /** Baidu's push API (data.zz.baidu.com/urls) — bring-your-own-token, per project */
  readonly baidu: BaiduResource;

  /** AI-drafted or hand-edited title/meta/canonical patches, reviewed before going live */
  readonly patches: PatchesResource;

  /** Log File Analyzer / Bot Analytics — upload a server access log, read back its bot-traffic report */
  readonly logAnalyzer: LogAnalyzerResource;

  /** Web Analytics (GAP-120) + AI referral attribution (GAP-122) — first-party, cookieless traffic reports from the project's own tracking snippet */
  readonly webAnalytics: WebAnalyticsResource;

  /** Cross-project dashboard (GAP-190) — one card per active project, no upstream calls */
  readonly dashboard: DashboardResource;

  /** Disavow file management (GAP-083) — per-project entries, exported in Google's exact disavow-file format */
  readonly disavow: DisavowResource;

  /** Usage transparency (GAP-197) — plan tier, credits, and quota usage for the caller's org */
  readonly usage: UsageResource;

  /** Portfolios (GAP-191) — group the org's own projects, view aggregate summary */
  readonly portfolios: PortfoliosResource;

  /** Report Builder (GAP-192) — user-composed report widget selections per project */
  readonly reportBuilder: ReportBuilderResource;

  /** On-page content optimizer + AI content grader (GAP-134 / GAP-137(a)) */
  readonly content: ContentResource;

  /** Competitor page change detection (GAP-164) — this codebase's own SSRF-safe crawler, no paid provider */
  readonly competitorMonitor: CompetitorMonitorResource;

  /** Google Business Profile — connection, profile, performance, reviews, posts, optimization (GAP-151 / GAP-152 / GAP-155) */
  readonly googleBusinessProfile: GoogleBusinessProfileResource;

  /** Local rank grid — geo-grid organic-rank tracking with heatmap output (GAP-150) */
  readonly localRankGrid: LocalRankGridResource;
  readonly localPackRank: LocalPackRankResource;

  /** Unlinked brand mentions (GAP-131) + Media Monitoring composition (GAP-183) */
  readonly mentions: MentionsResource;

  /** Direct Vendor Answers (GAP-206) — REAL, directly-verified vendor models (You.com, DeepSeek, xAI/Grok, Meta AI, MiniMax), each called through that vendor's own API, deliberately separate from `aiSearch.promptExplorer`'s anonymized personas */
  readonly directVendorAi: DirectVendorAiResource;

  /** Link Building Tool (GAP-084) — prospect list, outreach-status pipeline, activity log. White-hat scope: research + outreach assistance only, never automated submission */
  readonly linkBuilding: LinkBuildingResource;

  /** Organization members, pending invitations and the caller's role (read-only) */
  readonly team: TeamResource;

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
    this.ga4 = new Ga4Resource(this.http);
    this.aiSearch = new AiSearchResource(this.http);
    this.account = new AccountResource(this.http);
    this.activity = new ActivityResource(this.http);
    this.indexNow = new IndexNowResource(this.http);
    this.bing = new BingResource(this.http);
    this.ahrefs = new AhrefsResource(this.http);
    this.yandex = new YandexResource(this.http);
    this.braveSearch = new BraveSearchResource(this.http);
    this.baidu = new BaiduResource(this.http);
    this.patches = new PatchesResource(this.http);
    this.logAnalyzer = new LogAnalyzerResource(this.http);
    this.webAnalytics = new WebAnalyticsResource(this.http);
    this.dashboard = new DashboardResource(this.http);
    this.disavow = new DisavowResource(this.http);
    this.usage = new UsageResource(this.http);
    this.portfolios = new PortfoliosResource(this.http);
    this.reportBuilder = new ReportBuilderResource(this.http);
    this.content = new ContentResource(this.http);
    this.competitorMonitor = new CompetitorMonitorResource(this.http);
    this.googleBusinessProfile = new GoogleBusinessProfileResource(this.http);
    this.localRankGrid = new LocalRankGridResource(this.http);
    this.localPackRank = new LocalPackRankResource(this.http);
    this.mentions = new MentionsResource(this.http);
    this.directVendorAi = new DirectVendorAiResource(this.http);
    this.linkBuilding = new LinkBuildingResource(this.http);
    this.team = new TeamResource(this.http);
  }
}
