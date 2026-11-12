# MisarSEO Go SDK

> Keyword research, site audits, rank tracking and AI search visibility from Go.

[![Go Reference](https://pkg.go.dev/badge/github.com/Misar-AI/misarseo-sdks/go/misarseo.svg)](https://pkg.go.dev/github.com/Misar-AI/misarseo-sdks/go/misarseo)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**36 resource groups · 221 methods · SSE crawl streaming · standard library only**

MisarSEO is one API for the SEO work around a site: keyword and competitor research, crawls and audits, rank tracking (organic, local and AI Overviews), backlinks, AI-search brand visibility, and the data Google Search Console, GA4, Bing, Yandex and Baidu hold about it. Go 1.22+. Every call takes a `context.Context` and returns the decoded JSON (`any`).

Package: `github.com/Misar-AI/misarseo-sdks/go` on Go modules. Source: [github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks/tree/main/go).

---

## Install

### go get

```bash
go get github.com/Misar-AI/misarseo-sdks/go
```

---

## Authentication

Create an API key as described at https://seo.misar.io/ai. It starts with `mseo_` and is sent as `Authorization: Bearer mseo_…` — the only credential the SDK uses.

Every call is decided server-side against the plan of the organization that owns the key; there is no client-side limit checking. A plan refusal carries `code: "plan_limit_exceeded"` and an upgrade offer, and is never retried (see [Plan limits](#plan-limits)).

```go
import "github.com/Misar-AI/misarseo-sdks/go/misarseo"

seo, err := misarseo.NewClient(os.Getenv("MISARSEO_API_KEY"))
if err != nil {
	log.Fatal(err)
}
```

---

## Resources

Every group the client exposes, and every method on it — generated from [`manifest.json`](./manifest.json), the same file every MisarSEO SDK is built from. Arguments: `ctx`, path parameters, required query parameters, then `body any` (when the endpoint takes one) and `query map[string]string`.

### Workspace

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Projects` | `Create`, `Delete`, `Get`, `List`, `Update` | Projects in the organization: list, create, rename, archive. |
| `seo.Team` | `ListMembers` | Members, pending invitations and the caller's role (read-only). |
| `seo.Account` | `Delete`, `DeleteViaPost`, `Export` | Data-subject rights: full JSON export and account erasure. |
| `seo.Activity` | `List` | The organization's activity log, newest first (cursor paged). |
| `seo.Usage` | `Get` | Plan tier, credits and quota usage for the organization. |
| `seo.Dashboard` | `Get` | Cross-project overview — one card per active project. |
| `seo.Portfolios` | `AddProjects`, `Create`, `Delete`, `Get`, `List`, `RemoveProjects`, `Rename` | Group projects and read their aggregate summary. |
| `seo.ReportBuilder` | `CreateDefinition`, `DeleteDefinition`, `DeleteSchedule`, `GetDefinition`, `GetSchedule`, `ListDefinitions`, `RenameDefinition`, `RenderDefinition`, `SetWidgets`, `UpsertSchedule` | User-composed report definitions, widgets, rendering and schedules. |

### Keyword and competitive research

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Keywords` | `ClassifyIntent`, `Gap`, `ListSaved`, `ListShareOfVoice`, `Potential`, `Research`, `Save`, `SerpOverview`, `Strategy`, `TopicResearch` | Keyword research, saved keywords, intent, SERP overview, gap, topic research, strategy, share of voice. |
| `seo.Domain` | `AuthorityHistory`, `BatchOverview`, `CaptureAuthoritySnapshot`, `Overview` | Domain overview, batch overview and authority history. |
| `seo.Backlinks` | `Anchors`, `Intersect`, `Overview` | Backlink profile, anchors (offset paged) and link intersect. |
| `seo.Competitors` | `Find` | SERP competitor discovery. |
| `seo.Content` | `Optimizer`, `PageMetrics` | On-page content optimizer and page metrics. |
| `seo.Mentions` | `MediaMonitoring`, `UnlinkedMentions` | Unlinked brand mentions and media monitoring. |
| `seo.CompetitorMonitor` | `AddTarget`, `ListChanges`, `ListTargets`, `RemoveTarget` | Competitor page change detection. |
| `seo.LinkBuilding` | `Add`, `AddNote`, `ExportCsv`, `ImportCsv`, `List`, `ListActivity`, `Remove`, `Update`, `UpdateStatus` | Prospect list, outreach status, activity log, CSV import/export. |
| `seo.Disavow` | `Add`, `Export`, `List`, `Remove` | Disavow entries and Google's disavow-file export. |

### Site audit

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Crawl` | `ClearIssueStatus`, `Comparison`, `CoreWebVitals`, `CreateAuditSegment`, `CreateCustomIssueRule`, `CreateIssueMuteRule`, `CreateIssueSeverityOverride`, `DeleteAuditSegment`, `DeleteCustomIssueRule`, `DeleteIssueMuteRule`, `DeleteIssueSeverityOverride`, `HttpsReport`, `InternalLinks`, `ListAuditSegments`, `ListCustomIssueRules`, `ListIssueMuteRules`, `ListIssueSeverityOverrides`, `ListIssueStatuses`, `Segment`, `SetIssueStatus`, `Start`, `Status`, `StructuredDataReport`, `StreamEvents` (SSE) | Start a crawl, read status and comparisons, Core Web Vitals, triage rules, audit reports, and the live SSE progress stream. |
| `seo.Patches` | `BatchDraft`, `DisableAutoPublish`, `Draft`, `EnableAutoPublish`, `List`, `ListAutoPublishRules`, `Publish`, `Revert` | AI-drafted title/meta/canonical patches, publish/revert and auto-publish rules. |
| `seo.LogAnalyzer` | `DailySummary`, `GetUpload`, `ListUploads`, `TopPaths`, `Upload` | Server-log uploads and bot-traffic reports. |
| `seo.WebAnalytics` | `Devices`, `Sources`, `Summary`, `TopPages` | First-party, cookieless traffic and AI-referral reports. |

### Rank tracking

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.RankTracking` | `AddAnnotation`, `AddCompetitor`, `AddKeywords`, `Create`, `Delete`, `Get`, `GetAiOverviewTrend`, `GetConfigTrend`, `GetKeywordHistory`, `GetLatestRun`, `GetRankMovers`, `GetVolatilityIndex`, `ListAnnotations`, `ListCannibalisation`, `ListCompetitors`, `ListConfigs`, `ListKeywordTags`, `RemoveAnnotation`, `RemoveCompetitor`, `RemoveKeywords`, `SetKeywordTargetUrl`, `Update`, `UpdateKeywordTag` | Trackers, keywords, tags, runs, trends, movers, annotations, cannibalisation, competitors. |
| `seo.LocalRankGrid` | `CreateConfig`, `DeleteConfig`, `GetLatestRun`, `ListConfigs`, `RunCheck` | Geo-grid organic rank tracking. |
| `seo.LocalPackRank` | `CreateConfig`, `DeleteConfig`, `GetLatestCheck`, `ListConfigs`, `RunCheck` | Local-pack position of a named business. |
| `seo.BraveSearch` | `RankCheck` | Rank checks against Brave Search's independent index. |

### Local

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Local` | `BusinessListings`, `NapAudit`, `QuestionsAnswers` | Business listings, Q&A and NAP audit. |
| `seo.GoogleBusinessProfile` | `AvailableLocations`, `CreatePost`, `DeleteReviewReply`, `GetConnection`, `GetOptimization`, `GetPerformance`, `GetProfile`, `Link`, `ListPosts`, `ListReviews`, `ReplyToReview`, `Unlink` | Business Profile connection, profile, performance, reviews, posts, optimization. |

### AI search visibility

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.AiSearch` | `BrandLookup`, `BrandLookupStatus`, `BrandScanTrend`, `Citations`, `CompetitorPositioning`, `DeleteBrandMonitor`, `DeleteTrackedPrompt`, `ListBrandMonitors`, `ListTrackedPrompts`, `PromptExplorer`, `PromptResearch`, `TrackedPromptTrend`, `UpsertBrandMonitor`, `UpsertTrackedPrompt` | Brand lookup, prompt explorer, brand monitors, tracked prompts, competitor positioning, prompt research, citations. |
| `seo.DirectVendorAi` | `Answer` | Answers from vendors' own APIs (You.com, DeepSeek, xAI, Meta AI, MiniMax). |

### Search engines and analytics

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.Gsc` | `AnonymousQueries`, `Archive`, `Cannibalisation`, `Connect`, `ContentDecay`, `Coverage`, `CtrByPosition`, `Hourly`, `InspectUrls`, `Performance`, `Sitemaps` | Search Console performance, archive, coverage, URL inspection, sitemaps, reports. |
| `seo.Ga4` | `Channels`, `Connect`, `Daily`, `Disconnect`, `LandingPages`, `ListProperties`, `SetProperty` | Google Analytics 4 connection and reports. |
| `seo.Bing` | `Backlinks`, `Connect`, `DetailStats`, `Disconnect`, `GetFeedDetails`, `KeywordResearch`, `ListSites`, `SaveCrawlSettings`, `SetSite`, `SiteOverview`, `SubmitContent`, `SubmitFeed`, `UpdateBlockedUrl`, `UpdateQueryParameter`, `UrlInfo`, `UrlLinks` | Bing Webmaster: site overview, backlinks, keyword research, submissions, settings. |
| `seo.Yandex` | `Connect`, `Disconnect`, `ListHosts`, `ReindexUrl`, `SetHost`, `SiteOverview` | Yandex Webmaster: site overview, re-index, connection. |
| `seo.Baidu` | `Connection`, `Disconnect`, `SetConnection`, `SubmitUrls` | Baidu push API connection and URL submission. |
| `seo.IndexNow` | `Submit` | IndexNow URL submission. |
| `seo.Ahrefs` | `Connect`, `Disconnect`, `ListProjects`, `SetProject` | Ahrefs Connect project selection (inert until partner approval). |


---

## Client

```go
misarseo.NewClient("mseo_…",
	misarseo.WithBaseURL("https://api.misar.io/seo"), // default
	misarseo.WithHTTPClient(&http.Client{Timeout: 30 * time.Second}),
	misarseo.WithMaxRetries(2),
)
```

| Option | Default | Meaning |
| --- | --- | --- |
| base URL | `https://api.misar.io/seo` | API gateway. |
| timeout | 30 s | Per request; a stream's wait covers only the response headers. |
| max retries | 2 | Extra attempts for retryable failures (see [Retries](#retries)). |
| retry delays | 250 ms base, 60 s cap | Exponential backoff with jitter; `Retry-After` honoured up to the cap. |

---

## Quick start

```go
projects, err := seo.Projects.List(ctx, nil)

ideas, err := seo.Keywords.Research(ctx, map[string]any{
	"projectId": projectID,
	"keywords":  []string{"seo tools"},
}, nil)
```

---

## Primary functions

### Run a site audit and follow it live

```go
job, err := seo.Crawl.Start(ctx, map[string]any{"projectId": projectID, "startUrl": "https://example.com"}, nil)
jobID := job.(map[string]any)["jobId"].(string)

err = seo.Crawl.StreamEvents(ctx, jobID, projectID, nil, func(e misarseo.Event) bool {
	fmt.Println(e.Event, e.Data) // progress … then complete or error
	return true
})
```

### Read a backlink profile

```go
profile, err := seo.Backlinks.Overview(ctx, projectID, "example.com", nil)
```

---

## Errors

```go
_, err := seo.Projects.Get(ctx, "nope", nil)
var apiErr *misarseo.Error
if errors.As(err, &apiErr) {
	fmt.Println(apiErr.Status, apiErr.Code) // 404 NOT_FOUND
}
```

| Type | When |
| --- | --- |
| `*misarseo.Error` | `Status`, `Code`, `Message`, `Body`, `RetryAfter`; helpers `IsNotFound`, `IsUnauthorized`, `IsRateLimited`. |
| `*misarseo.PlanLimitError` | `Offer`, `Reason`, `Feature`, `Plan`, `UpgradeURL`, `RetryAfter`. |

### Plan limits

A call the organization's plan does not cover answers with

```json
{ "error": "...", "code": "plan_limit_exceeded", "upgrade": { "reason", "feature", "headline", "plans": [...], "urls": { "pricing" }, "cta" } }
```

- **402** — the feature is not in the plan, or a point-in-time cap (projects, API keys, tracked keywords) is reached.
- **429** with `Retry-After` — a day/month quota is spent; it resets at the period rollover.

Detection is by `code`, never by status: a quota block is a 429 and would otherwise look like an ordinary throttle. Every piece of copy — plan names, prices, what each plan unlocks, URLs — is in the offer, so render it rather than hard-coding any of it. `x-misar-plan` and `x-misar-upgrade-url` response headers carry the current plan and upgrade link.

```go
var planErr *misarseo.PlanLimitError
if errors.As(err, &planErr) {
	fmt.Println(planErr.Offer["headline"], planErr.UpgradeURL)
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

```go
err := misarseo.IterateOffsetPages(ctx, 1,
	func(ctx context.Context, page int) (misarseo.OffsetPage, error) {
		v, err := seo.Backlinks.Anchors(ctx, projectID, "example.com", map[string]string{"page": strconv.Itoa(page)})
		offset, _ := misarseo.PageFrom(v)
		return offset, err
	},
	func(row any) bool { fmt.Println(row); return true })
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
