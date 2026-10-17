# MisarSEO Java SDK

> Keyword research, site audits, rank tracking and AI search visibility from Java 17.

[![Maven Central](https://img.shields.io/maven-central/v/io.misar/misarseo)](https://central.sonatype.com/artifact/io.misar/misarseo)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**36 resource groups · 221 methods · SSE crawl streaming · Jackson the only dependency**

MisarSEO is one API for the SEO work around a site: keyword and competitor research, crawls and audits, rank tracking (organic, local and AI Overviews), backlinks, AI-search brand visibility, and the data Google Search Console, GA4, Bing, Yandex and Baidu hold about it. Java 17+, on `java.net.http`. Every method returns a Jackson `JsonNode`.

Package: `io.misar:misarseo` on Maven Central. Source: [github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks/tree/main/java).

---

## Install

### Maven

```xml
<dependency>
  <groupId>io.misar</groupId>
  <artifactId>misarseo</artifactId>
  <version>1.0.0</version>
</dependency>
```

### Gradle

```kotlin
implementation("io.misar:misarseo:1.0.0")
```

---

## Authentication

Create an API key as described at https://seo.misar.io/ai. It starts with `mseo_` and is sent as `Authorization: Bearer mseo_…` — the only credential the SDK uses.

Every call is decided server-side against the plan of the organization that owns the key; there is no client-side limit checking. A plan refusal carries `code: "plan_limit_exceeded"` and an upgrade offer, and is never retried (see [Plan limits](#plan-limits)).

```java
import io.misar.seo.MisarSeoClient;

MisarSeoClient seo = new MisarSeoClient(System.getenv("MISARSEO_API_KEY"));
```

---

## Resources

Every group the client exposes, and every method on it — generated from [`manifest.json`](./manifest.json), the same file every MisarSEO SDK is built from. Arguments: path parameters and required query parameters as `String`, then `Object body` (when the endpoint takes one) and `Map<String, String> query` (nullable).

### Workspace

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.projects` | `create`, `delete`, `get`, `list`, `update` | Projects in the organization: list, create, rename, archive. |
| `seo.team` | `listMembers` | Members, pending invitations and the caller's role (read-only). |
| `seo.account` | `delete`, `deleteViaPost`, `export` | Data-subject rights: full JSON export and account erasure. |
| `seo.activity` | `list` | The organization's activity log, newest first (cursor paged). |
| `seo.usage` | `get` | Plan tier, credits and quota usage for the organization. |
| `seo.dashboard` | `get` | Cross-project overview — one card per active project. |
| `seo.portfolios` | `addProjects`, `create`, `delete`, `get`, `list`, `removeProjects`, `rename` | Group projects and read their aggregate summary. |
| `seo.reportBuilder` | `createDefinition`, `deleteDefinition`, `deleteSchedule`, `getDefinition`, `getSchedule`, `listDefinitions`, `renameDefinition`, `renderDefinition`, `setWidgets`, `upsertSchedule` | User-composed report definitions, widgets, rendering and schedules. |

### Keyword and competitive research

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.keywords` | `classifyIntent`, `gap`, `listSaved`, `listShareOfVoice`, `potential`, `research`, `save`, `serpOverview`, `strategy`, `topicResearch` | Keyword research, saved keywords, intent, SERP overview, gap, topic research, strategy, share of voice. |
| `seo.domain` | `authorityHistory`, `batchOverview`, `captureAuthoritySnapshot`, `overview` | Domain overview, batch overview and authority history. |
| `seo.backlinks` | `anchors`, `intersect`, `overview` | Backlink profile, anchors (offset paged) and link intersect. |
| `seo.competitors` | `find` | SERP competitor discovery. |
| `seo.content` | `optimizer`, `pageMetrics` | On-page content optimizer and page metrics. |
| `seo.mentions` | `mediaMonitoring`, `unlinkedMentions` | Unlinked brand mentions and media monitoring. |
| `seo.competitorMonitor` | `addTarget`, `listChanges`, `listTargets`, `removeTarget` | Competitor page change detection. |
| `seo.linkBuilding` | `add`, `addNote`, `exportCsv`, `importCsv`, `list`, `listActivity`, `remove`, `update`, `updateStatus` | Prospect list, outreach status, activity log, CSV import/export. |
| `seo.disavow` | `add`, `export`, `list`, `remove` | Disavow entries and Google's disavow-file export. |

### Site audit

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.crawl` | `clearIssueStatus`, `comparison`, `coreWebVitals`, `createAuditSegment`, `createCustomIssueRule`, `createIssueMuteRule`, `createIssueSeverityOverride`, `deleteAuditSegment`, `deleteCustomIssueRule`, `deleteIssueMuteRule`, `deleteIssueSeverityOverride`, `httpsReport`, `internalLinks`, `listAuditSegments`, `listCustomIssueRules`, `listIssueMuteRules`, `listIssueSeverityOverrides`, `listIssueStatuses`, `segment`, `setIssueStatus`, `start`, `status`, `structuredDataReport`, `streamEvents` (SSE) | Start a crawl, read status and comparisons, Core Web Vitals, triage rules, audit reports, and the live SSE progress stream. |
| `seo.patches` | `batchDraft`, `disableAutoPublish`, `draft`, `enableAutoPublish`, `list`, `listAutoPublishRules`, `publish`, `revert` | AI-drafted title/meta/canonical patches, publish/revert and auto-publish rules. |
| `seo.logAnalyzer` | `dailySummary`, `getUpload`, `listUploads`, `topPaths`, `upload` | Server-log uploads and bot-traffic reports. |
| `seo.webAnalytics` | `devices`, `sources`, `summary`, `topPages` | First-party, cookieless traffic and AI-referral reports. |

### Rank tracking

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.rankTracking` | `addAnnotation`, `addCompetitor`, `addKeywords`, `create`, `delete`, `get`, `getAiOverviewTrend`, `getConfigTrend`, `getKeywordHistory`, `getLatestRun`, `getRankMovers`, `getVolatilityIndex`, `listAnnotations`, `listCannibalisation`, `listCompetitors`, `listConfigs`, `listKeywordTags`, `removeAnnotation`, `removeCompetitor`, `removeKeywords`, `setKeywordTargetUrl`, `update`, `updateKeywordTag` | Trackers, keywords, tags, runs, trends, movers, annotations, cannibalisation, competitors. |
| `seo.localRankGrid` | `createConfig`, `deleteConfig`, `getLatestRun`, `listConfigs`, `runCheck` | Geo-grid organic rank tracking. |
| `seo.localPackRank` | `createConfig`, `deleteConfig`, `getLatestCheck`, `listConfigs`, `runCheck` | Local-pack position of a named business. |
| `seo.braveSearch` | `rankCheck` | Rank checks against Brave Search's independent index. |

### Local

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.local` | `businessListings`, `napAudit`, `questionsAnswers` | Business listings, Q&A and NAP audit. |
| `seo.googleBusinessProfile` | `availableLocations`, `createPost`, `deleteReviewReply`, `getConnection`, `getOptimization`, `getPerformance`, `getProfile`, `link`, `listPosts`, `listReviews`, `replyToReview`, `unlink` | Business Profile connection, profile, performance, reviews, posts, optimization. |

### AI search visibility

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.aiSearch` | `brandLookup`, `brandLookupStatus`, `brandScanTrend`, `citations`, `competitorPositioning`, `deleteBrandMonitor`, `deleteTrackedPrompt`, `listBrandMonitors`, `listTrackedPrompts`, `promptExplorer`, `promptResearch`, `trackedPromptTrend`, `upsertBrandMonitor`, `upsertTrackedPrompt` | Brand lookup, prompt explorer, brand monitors, tracked prompts, competitor positioning, prompt research, citations. |
| `seo.directVendorAi` | `answer` | Answers from vendors' own APIs (You.com, DeepSeek, xAI, Meta AI, MiniMax). |

### Search engines and analytics

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.gsc` | `anonymousQueries`, `archive`, `cannibalisation`, `connect`, `contentDecay`, `coverage`, `ctrByPosition`, `hourly`, `inspectUrls`, `performance`, `sitemaps` | Search Console performance, archive, coverage, URL inspection, sitemaps, reports. |
| `seo.ga4` | `channels`, `connect`, `daily`, `disconnect`, `landingPages`, `listProperties`, `setProperty` | Google Analytics 4 connection and reports. |
| `seo.bing` | `backlinks`, `connect`, `detailStats`, `disconnect`, `getFeedDetails`, `keywordResearch`, `listSites`, `saveCrawlSettings`, `setSite`, `siteOverview`, `submitContent`, `submitFeed`, `updateBlockedUrl`, `updateQueryParameter`, `urlInfo`, `urlLinks` | Bing Webmaster: site overview, backlinks, keyword research, submissions, settings. |
| `seo.yandex` | `connect`, `disconnect`, `listHosts`, `reindexUrl`, `setHost`, `siteOverview` | Yandex Webmaster: site overview, re-index, connection. |
| `seo.baidu` | `connection`, `disconnect`, `setConnection`, `submitUrls` | Baidu push API connection and URL submission. |
| `seo.indexNow` | `submit` | IndexNow URL submission. |
| `seo.ahrefs` | `connect`, `disconnect`, `listProjects`, `setProject` | Ahrefs Connect project selection (inert until partner approval). |


---

## Client

```java
MisarSeoClient.Config config = new MisarSeoClient.Config("mseo_…");
config.baseUrl = "https://api.misar.io/seo"; // default
config.timeout = Duration.ofSeconds(30);
config.maxRetries = 2;
MisarSeoClient seo = new MisarSeoClient(config);
```

| Option | Default | Meaning |
| --- | --- | --- |
| base URL | `https://api.misar.io/seo` | API gateway. |
| timeout | 30 s | Per request; a stream's wait covers only the response headers. |
| max retries | 2 | Extra attempts for retryable failures (see [Retries](#retries)). |
| retry delays | 250 ms base, 60 s cap | Exponential backoff with jitter; `Retry-After` honoured up to the cap. |

---

## Quick start

```java
JsonNode projects = seo.projects.list(null);
String projectId = projects.get("projects").get(0).get("id").asText();

JsonNode ideas = seo.keywords.research(Map.of("projectId", projectId, "keywords", List.of("seo tools")), null);
```

---

## Primary functions

### Run a site audit and follow it live

```java
JsonNode job = seo.crawl.start(Map.of("projectId", projectId, "startUrl", "https://example.com"), null);

seo.crawl.streamEvents(job.get("jobId").asText(), projectId, null, event -> {
    System.out.println(event.event() + " " + event.data()); // progress … then complete or error
    return true;
});
```

### Read a backlink profile

```java
JsonNode profile = seo.backlinks.overview(projectId, "example.com", null);
```

---

## Errors

```java
try {
    seo.projects.get("nope", null);
} catch (MisarSeoException e) {
    System.out.println(e.getStatus() + " " + e.getCode()); // 404 NOT_FOUND
}
```

| Type | When |
| --- | --- |
| `MisarSeoException` | Unchecked; `getStatus()`, `getCode()`, `getBody()`, `getRetryAfter()`, `isNotFound()`. |
| `MisarSeoPlanLimitException` | `getOffer()`, `getReason()`, `getFeature()`, `getPlan()`, `getUpgradeUrl()`. |

### Plan limits

A call the organization's plan does not cover answers with

```json
{ "error": "...", "code": "plan_limit_exceeded", "upgrade": { "reason", "feature", "headline", "plans": [...], "urls": { "pricing" }, "cta" } }
```

- **402** — the feature is not in the plan, or a point-in-time cap (projects, API keys, tracked keywords) is reached.
- **429** with `Retry-After` — a day/month quota is spent; it resets at the period rollover.

Detection is by `code`, never by status: a quota block is a 429 and would otherwise look like an ordinary throttle. Every piece of copy — plan names, prices, what each plan unlocks, URLs — is in the offer, so render it rather than hard-coding any of it. `x-misar-plan` and `x-misar-upgrade-url` response headers carry the current plan and upgrade link.

```java
try {
    seo.keywords.research(Map.of("projectId", projectId, "keywords", List.of("seo")), null);
} catch (MisarSeoPlanLimitException e) {
    System.out.println(e.getOffer().get("headline").asText() + " " + e.getUpgradeUrl());
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

```java
List<JsonNode> anchors = Pagination.collectOffsetPages(1,
    page -> seo.backlinks.anchors(projectId, "example.com", Map.of("page", String.valueOf(page))));
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
