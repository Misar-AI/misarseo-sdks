# MisarSEO .NET SDK

> Keyword research, site audits, rank tracking and AI search visibility from C# and .NET.

[![NuGet](https://img.shields.io/nuget/v/MisarSEO)](https://www.nuget.org/packages/MisarSEO)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**36 resource groups · 221 methods · SSE crawl streaming · no dependencies beyond the BCL**

MisarSEO is one API for the SEO work around a site: keyword and competitor research, crawls and audits, rank tracking (organic, local and AI Overviews), backlinks, AI-search brand visibility, and the data Google Search Console, GA4, Bing, Yandex and Baidu hold about it. .NET 8+. Every method is `…Async`, takes a `CancellationToken` and returns a `JsonElement`.

Package: `MisarSEO` on NuGet. Source: [github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks/tree/main/csharp).

---

## Install

### .NET CLI

```bash
dotnet add package MisarSEO
```

---

## Authentication

Create an API key as described at https://seo.misar.io/ai. It starts with `mseo_` and is sent as `Authorization: Bearer mseo_…` — the only credential the SDK uses.

Every call is decided server-side against the plan of the organization that owns the key; there is no client-side limit checking. A plan refusal carries `code: "plan_limit_exceeded"` and an upgrade offer, and is never retried (see [Plan limits](#plan-limits)).

```csharp
using MisarSEO;

var seo = new MisarSeoClient(Environment.GetEnvironmentVariable("MISARSEO_API_KEY"));
```

---

## Resources

Every group the client exposes, and every method on it — generated from [`manifest.json`](./manifest.json), the same file every MisarSEO SDK is built from. Arguments: path parameters and required query parameters (`string`), then `object? body` (when the endpoint takes one), `IDictionary<string, string>? query` and a `CancellationToken`.

### Workspace

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Projects` | `CreateAsync`, `DeleteAsync`, `GetAsync`, `ListAsync`, `UpdateAsync` | Projects in the organization: list, create, rename, archive. |
| `seo.Team` | `ListMembersAsync` | Members, pending invitations and the caller's role (read-only). |
| `seo.Account` | `DeleteAsync`, `DeleteViaPostAsync`, `ExportAsync` | Data-subject rights: full JSON export and account erasure. |
| `seo.Activity` | `ListAsync` | The organization's activity log, newest first (cursor paged). |
| `seo.Usage` | `GetAsync` | Plan tier, credits and quota usage for the organization. |
| `seo.Dashboard` | `GetAsync` | Cross-project overview — one card per active project. |
| `seo.Portfolios` | `AddProjectsAsync`, `CreateAsync`, `DeleteAsync`, `GetAsync`, `ListAsync`, `RemoveProjectsAsync`, `RenameAsync` | Group projects and read their aggregate summary. |
| `seo.ReportBuilder` | `CreateDefinitionAsync`, `DeleteDefinitionAsync`, `DeleteScheduleAsync`, `GetDefinitionAsync`, `GetScheduleAsync`, `ListDefinitionsAsync`, `RenameDefinitionAsync`, `RenderDefinitionAsync`, `SetWidgetsAsync`, `UpsertScheduleAsync` | User-composed report definitions, widgets, rendering and schedules. |

### Keyword and competitive research

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Keywords` | `ClassifyIntentAsync`, `GapAsync`, `ListSavedAsync`, `ListShareOfVoiceAsync`, `PotentialAsync`, `ResearchAsync`, `SaveAsync`, `SerpOverviewAsync`, `StrategyAsync`, `TopicResearchAsync` | Keyword research, saved keywords, intent, SERP overview, gap, topic research, strategy, share of voice. |
| `seo.Domain` | `AuthorityHistoryAsync`, `BatchOverviewAsync`, `CaptureAuthoritySnapshotAsync`, `OverviewAsync` | Domain overview, batch overview and authority history. |
| `seo.Backlinks` | `AnchorsAsync`, `IntersectAsync`, `OverviewAsync` | Backlink profile, anchors (offset paged) and link intersect. |
| `seo.Competitors` | `FindAsync` | SERP competitor discovery. |
| `seo.Content` | `OptimizerAsync`, `PageMetricsAsync` | On-page content optimizer and page metrics. |
| `seo.Mentions` | `MediaMonitoringAsync`, `UnlinkedMentionsAsync` | Unlinked brand mentions and media monitoring. |
| `seo.CompetitorMonitor` | `AddTargetAsync`, `ListChangesAsync`, `ListTargetsAsync`, `RemoveTargetAsync` | Competitor page change detection. |
| `seo.LinkBuilding` | `AddAsync`, `AddNoteAsync`, `ExportCsvAsync`, `ImportCsvAsync`, `ListAsync`, `ListActivityAsync`, `RemoveAsync`, `UpdateAsync`, `UpdateStatusAsync` | Prospect list, outreach status, activity log, CSV import/export. |
| `seo.Disavow` | `AddAsync`, `ExportAsync`, `ListAsync`, `RemoveAsync` | Disavow entries and Google's disavow-file export. |

### Site audit

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Crawl` | `ClearIssueStatusAsync`, `ComparisonAsync`, `CoreWebVitalsAsync`, `CreateAuditSegmentAsync`, `CreateCustomIssueRuleAsync`, `CreateIssueMuteRuleAsync`, `CreateIssueSeverityOverrideAsync`, `DeleteAuditSegmentAsync`, `DeleteCustomIssueRuleAsync`, `DeleteIssueMuteRuleAsync`, `DeleteIssueSeverityOverrideAsync`, `HttpsReportAsync`, `InternalLinksAsync`, `ListAuditSegmentsAsync`, `ListCustomIssueRulesAsync`, `ListIssueMuteRulesAsync`, `ListIssueSeverityOverridesAsync`, `ListIssueStatusesAsync`, `SegmentAsync`, `SetIssueStatusAsync`, `StartAsync`, `StatusAsync`, `StructuredDataReportAsync`, `StreamEventsAsync` (SSE) | Start a crawl, read status and comparisons, Core Web Vitals, triage rules, audit reports, and the live SSE progress stream. |
| `seo.Patches` | `BatchDraftAsync`, `DisableAutoPublishAsync`, `DraftAsync`, `EnableAutoPublishAsync`, `ListAsync`, `ListAutoPublishRulesAsync`, `PublishAsync`, `RevertAsync` | AI-drafted title/meta/canonical patches, publish/revert and auto-publish rules. |
| `seo.LogAnalyzer` | `DailySummaryAsync`, `GetUploadAsync`, `ListUploadsAsync`, `TopPathsAsync`, `UploadAsync` | Server-log uploads and bot-traffic reports. |
| `seo.WebAnalytics` | `DevicesAsync`, `SourcesAsync`, `SummaryAsync`, `TopPagesAsync` | First-party, cookieless traffic and AI-referral reports. |

### Rank tracking

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.RankTracking` | `AddAnnotationAsync`, `AddCompetitorAsync`, `AddKeywordsAsync`, `CreateAsync`, `DeleteAsync`, `GetAsync`, `GetAiOverviewTrendAsync`, `GetConfigTrendAsync`, `GetKeywordHistoryAsync`, `GetLatestRunAsync`, `GetRankMoversAsync`, `GetVolatilityIndexAsync`, `ListAnnotationsAsync`, `ListCannibalisationAsync`, `ListCompetitorsAsync`, `ListConfigsAsync`, `ListKeywordTagsAsync`, `RemoveAnnotationAsync`, `RemoveCompetitorAsync`, `RemoveKeywordsAsync`, `SetKeywordTargetUrlAsync`, `UpdateAsync`, `UpdateKeywordTagAsync` | Trackers, keywords, tags, runs, trends, movers, annotations, cannibalisation, competitors. |
| `seo.LocalRankGrid` | `CreateConfigAsync`, `DeleteConfigAsync`, `GetLatestRunAsync`, `ListConfigsAsync`, `RunCheckAsync` | Geo-grid organic rank tracking. |
| `seo.LocalPackRank` | `CreateConfigAsync`, `DeleteConfigAsync`, `GetLatestCheckAsync`, `ListConfigsAsync`, `RunCheckAsync` | Local-pack position of a named business. |
| `seo.BraveSearch` | `RankCheckAsync` | Rank checks against Brave Search's independent index. |

### Local

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Local` | `BusinessListingsAsync`, `NapAuditAsync`, `QuestionsAnswersAsync` | Business listings, Q&A and NAP audit. |
| `seo.GoogleBusinessProfile` | `AvailableLocationsAsync`, `CreatePostAsync`, `DeleteReviewReplyAsync`, `GetConnectionAsync`, `GetOptimizationAsync`, `GetPerformanceAsync`, `GetProfileAsync`, `LinkAsync`, `ListPostsAsync`, `ListReviewsAsync`, `ReplyToReviewAsync`, `UnlinkAsync` | Business Profile connection, profile, performance, reviews, posts, optimization. |

### AI search visibility

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.AiSearch` | `BrandLookupAsync`, `BrandLookupStatusAsync`, `BrandScanTrendAsync`, `CitationsAsync`, `CompetitorPositioningAsync`, `DeleteBrandMonitorAsync`, `DeleteTrackedPromptAsync`, `ListBrandMonitorsAsync`, `ListTrackedPromptsAsync`, `PromptExplorerAsync`, `PromptResearchAsync`, `TrackedPromptTrendAsync`, `UpsertBrandMonitorAsync`, `UpsertTrackedPromptAsync` | Brand lookup, prompt explorer, brand monitors, tracked prompts, competitor positioning, prompt research, citations. |
| `seo.DirectVendorAi` | `AnswerAsync` | Answers from vendors' own APIs (You.com, DeepSeek, xAI, Meta AI, MiniMax). |

### Search engines and analytics

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Gsc` | `AnonymousQueriesAsync`, `ArchiveAsync`, `CannibalisationAsync`, `ConnectAsync`, `ContentDecayAsync`, `CoverageAsync`, `CtrByPositionAsync`, `HourlyAsync`, `InspectUrlsAsync`, `PerformanceAsync`, `SitemapsAsync` | Search Console performance, archive, coverage, URL inspection, sitemaps, reports. |
| `seo.Ga4` | `ChannelsAsync`, `ConnectAsync`, `DailyAsync`, `DisconnectAsync`, `LandingPagesAsync`, `ListPropertiesAsync`, `SetPropertyAsync` | Google Analytics 4 connection and reports. |
| `seo.Bing` | `BacklinksAsync`, `ConnectAsync`, `DetailStatsAsync`, `DisconnectAsync`, `GetFeedDetailsAsync`, `KeywordResearchAsync`, `ListSitesAsync`, `SaveCrawlSettingsAsync`, `SetSiteAsync`, `SiteOverviewAsync`, `SubmitContentAsync`, `SubmitFeedAsync`, `UpdateBlockedUrlAsync`, `UpdateQueryParameterAsync`, `UrlInfoAsync`, `UrlLinksAsync` | Bing Webmaster: site overview, backlinks, keyword research, submissions, settings. |
| `seo.Yandex` | `ConnectAsync`, `DisconnectAsync`, `ListHostsAsync`, `ReindexUrlAsync`, `SetHostAsync`, `SiteOverviewAsync` | Yandex Webmaster: site overview, re-index, connection. |
| `seo.Baidu` | `ConnectionAsync`, `DisconnectAsync`, `SetConnectionAsync`, `SubmitUrlsAsync` | Baidu push API connection and URL submission. |
| `seo.IndexNow` | `SubmitAsync` | IndexNow URL submission. |
| `seo.Ahrefs` | `ConnectAsync`, `DisconnectAsync`, `ListProjectsAsync`, `SetProjectAsync` | Ahrefs Connect project selection (inert until partner approval). |


---

## Client

```csharp
new MisarSeoClient("mseo_…", new MisarSeoClientOptions
{
    BaseUrl = "https://api.misar.io/seo", // default
    Timeout = TimeSpan.FromSeconds(30),
    MaxRetries = 2,
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| base URL | `https://api.misar.io/seo` | API gateway. |
| timeout | 30 s | Per request; a stream's wait covers only the response headers. |
| max retries | 2 | Extra attempts for retryable failures (see [Retries](#retries)). |
| retry delays | 250 ms base, 60 s cap | Exponential backoff with jitter; `Retry-After` honoured up to the cap. |

---

## Quick start

```csharp
var projects = await seo.Projects.ListAsync();
var projectId = projects.GetProperty("projects")[0].GetProperty("id").GetString()!;

var ideas = await seo.Keywords.ResearchAsync(new { projectId, keywords = new[] { "seo tools" } });
```

---

## Primary functions

### Run a site audit and follow it live

```csharp
var job = await seo.Crawl.StartAsync(new { projectId, startUrl = "https://example.com" });

await foreach (var frame in seo.Crawl.StreamEventsAsync(job.GetProperty("jobId").GetString()!, projectId))
{
    Console.WriteLine($"{frame.Event} {frame.Data}"); // progress … then complete or error
}
```

### Read a backlink profile

```csharp
var profile = await seo.Backlinks.OverviewAsync(projectId, "example.com");
```

---

## Errors

```csharp
try
{
    await seo.Projects.GetAsync("nope");
}
catch (MisarSeoException e) when (e.IsNotFound)
{
    Console.WriteLine(e.Code); // NOT_FOUND
}
```

| Type | When |
| --- | --- |
| `MisarSeoException` | `Status`, `Code`, `Body`, `RetryAfter`, `IsNotFound`, `IsRateLimited`. |
| `MisarSeoPlanLimitException` | `Offer`, `Reason`, `Feature`, `Plan`, `UpgradeUrl`. |

### Plan limits

A call the organization's plan does not cover answers with

```json
{ "error": "...", "code": "plan_limit_exceeded", "upgrade": { "reason", "feature", "headline", "plans": [...], "urls": { "pricing" }, "cta" } }
```

- **402** — the feature is not in the plan, or a point-in-time cap (projects, API keys, tracked keywords) is reached.
- **429** with `Retry-After` — a day/month quota is spent; it resets at the period rollover.

Detection is by `code`, never by status: a quota block is a 429 and would otherwise look like an ordinary throttle. Every piece of copy — plan names, prices, what each plan unlocks, URLs — is in the offer, so render it rather than hard-coding any of it. `x-misar-plan` and `x-misar-upgrade-url` response headers carry the current plan and upgrade link.

```csharp
try
{
    await seo.Keywords.ResearchAsync(new { projectId, keywords = new[] { "seo" } });
}
catch (MisarSeoPlanLimitException e)
{
    Console.WriteLine($"{e.Offer?.GetProperty("headline")} {e.UpgradeUrl}");
}
```

---

## Retries

- **429** is retried for every method (the limiter refuses before any work is done) — except a `plan_limit_exceeded` body, which is never retried.
- **502/503/504 and network failures** are retried for GET only: a POST may already have started a billed crawl.
- Exponential backoff from 250 ms with jitter; a `Retry-After` longer than the cap raises immediately instead of parking the caller.
- 400/401/402/403/404/409 and 500/501 are never retried — they fail the same way every time.

---

## Pagination

The API pages two ways: offset pages (`{ rows, hasMore, page }`, e.g. backlink anchors) and keyset pages (`{ rows, hasMore, nextCursor }`, e.g. the activity log, whose rows are under `entries`). The helpers stop on `hasMore: false`, on an empty page, or on a repeated cursor, so a shrinking result set cannot loop forever against a billed endpoint.

```csharp
await foreach (var anchor in Pagination.OffsetRowsAsync(page =>
    seo.Backlinks.AnchorsAsync(projectId, "example.com", new Dictionary<string, string> { ["page"] = page.ToString() })))
{
    Console.WriteLine(anchor);
}
```

---

## Streaming

`crawl` progress is a Server-Sent Events stream (`GET /crawl/:jobId/stream`, `Accept: text/event-stream`): `progress` frames roughly every 1.5 s, then one terminal `complete` or `error`, after which the SDK ends the stream. It is never retried — replaying a stream would duplicate what was already consumed. See [Run a site audit](#run-a-site-audit-and-follow-it-live).

---

## Versioning

Semantic versioning; see [CHANGELOG.md](./CHANGELOG.md). Every SDK is generated from the same `manifest.json` (API 1.1.0), so a method added to the API appears in all thirteen at once.

---

## Links

- Product: https://seo.misar.io
- API docs: https://docs.misar.io/seo
- Issues: https://github.com/Misar-AI/misarseo-sdks/issues
- Status: https://status.misar.io

## License

MIT — see [LICENSE](./LICENSE).
