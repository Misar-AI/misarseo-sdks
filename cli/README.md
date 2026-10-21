# MisarSEO CLI SDK

> Every MisarSEO endpoint as a terminal command.

[![npm](https://img.shields.io/npm/v/@misarseo/cli)](https://www.npmjs.com/package/@misarseo/cli)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**36 resource groups · 221 methods · SSE crawl streaming · zero runtime dependencies**

MisarSEO is one API for the SEO work around a site: keyword and competitor research, crawls and audits, rank tracking (organic, local and AI Overviews), backlinks, AI-search brand visibility, and the data Google Search Console, GA4, Bing, Yandex and Baidu hold about it. Node 18+. `misarseo <resource> <command> [args] [--body JSON] [--param value]`; output is the JSON response. Exit codes: 0 success, 1 API error, 2 usage error, 3 plan limit (the upgrade card goes to stderr).

Package: `@misarseo/cli` on npm. Source: [github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks/tree/main/cli).

---

## Install

### npm

```bash
npm install -g @misarseo/cli
```

### npx

```bash
npx @misarseo/cli list
```

---

## Authentication

Create an API key as described at https://seo.misar.io/ai. It starts with `mseo_` and is sent as `Authorization: Bearer mseo_…` — the only credential the SDK uses.

Every call is decided server-side against the plan of the organization that owns the key; there is no client-side limit checking. A plan refusal carries `code: "plan_limit_exceeded"` and an upgrade offer, and is never retried (see [Plan limits](#plan-limits)).

```bash
export MISARSEO_API_KEY=mseo_…   # or pass --api-key on any command
```

---

## Resources

Every group the client exposes, and every method on it — generated from [`manifest.json`](./manifest.json), the same file every MisarSEO SDK is built from. Positional arguments are path parameters then required query parameters; `--body` takes JSON or `@file.json`; any other `--flag value` becomes a query parameter.

### Workspace

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo projects` | `create`, `delete`, `get`, `list`, `update` | Projects in the organization: list, create, rename, archive. |
| `misarseo team` | `list-members` | Members, pending invitations and the caller's role (read-only). |
| `misarseo account` | `delete`, `delete-via-post`, `export` | Data-subject rights: full JSON export and account erasure. |
| `misarseo activity` | `list` | The organization's activity log, newest first (cursor paged). |
| `misarseo usage` | `get` | Plan tier, credits and quota usage for the organization. |
| `misarseo dashboard` | `get` | Cross-project overview — one card per active project. |
| `misarseo portfolios` | `add-projects`, `create`, `delete`, `get`, `list`, `remove-projects`, `rename` | Group projects and read their aggregate summary. |
| `misarseo report-builder` | `create-definition`, `delete-definition`, `delete-schedule`, `get-definition`, `get-schedule`, `list-definitions`, `rename-definition`, `render-definition`, `set-widgets`, `upsert-schedule` | User-composed report definitions, widgets, rendering and schedules. |

### Keyword and competitive research

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo keywords` | `classify-intent`, `gap`, `list-saved`, `list-share-of-voice`, `potential`, `research`, `save`, `serp-overview`, `strategy`, `topic-research` | Keyword research, saved keywords, intent, SERP overview, gap, topic research, strategy, share of voice. |
| `misarseo domain` | `authority-history`, `batch-overview`, `capture-authority-snapshot`, `overview` | Domain overview, batch overview and authority history. |
| `misarseo backlinks` | `anchors`, `intersect`, `overview` | Backlink profile, anchors (offset paged) and link intersect. |
| `misarseo competitors` | `find` | SERP competitor discovery. |
| `misarseo content` | `optimizer`, `page-metrics` | On-page content optimizer and page metrics. |
| `misarseo mentions` | `media-monitoring`, `unlinked-mentions` | Unlinked brand mentions and media monitoring. |
| `misarseo competitor-monitor` | `add-target`, `list-changes`, `list-targets`, `remove-target` | Competitor page change detection. |
| `misarseo link-building` | `add`, `add-note`, `export-csv`, `import-csv`, `list`, `list-activity`, `remove`, `update`, `update-status` | Prospect list, outreach status, activity log, CSV import/export. |
| `misarseo disavow` | `add`, `export`, `list`, `remove` | Disavow entries and Google's disavow-file export. |

### Site audit

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo crawl` | `clear-issue-status`, `comparison`, `core-web-vitals`, `create-audit-segment`, `create-custom-issue-rule`, `create-issue-mute-rule`, `create-issue-severity-override`, `delete-audit-segment`, `delete-custom-issue-rule`, `delete-issue-mute-rule`, `delete-issue-severity-override`, `https-report`, `internal-links`, `list-audit-segments`, `list-custom-issue-rules`, `list-issue-mute-rules`, `list-issue-severity-overrides`, `list-issue-statuses`, `segment`, `set-issue-status`, `start`, `status`, `structured-data-report`, `stream-events` (SSE) | Start a crawl, read status and comparisons, Core Web Vitals, triage rules, audit reports, and the live SSE progress stream. |
| `misarseo patches` | `batch-draft`, `disable-auto-publish`, `draft`, `enable-auto-publish`, `list`, `list-auto-publish-rules`, `publish`, `revert` | AI-drafted title/meta/canonical patches, publish/revert and auto-publish rules. |
| `misarseo log-analyzer` | `daily-summary`, `get-upload`, `list-uploads`, `top-paths`, `upload` | Server-log uploads and bot-traffic reports. |
| `misarseo web-analytics` | `devices`, `sources`, `summary`, `top-pages` | First-party, cookieless traffic and AI-referral reports. |

### Rank tracking

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo rank-tracking` | `add-annotation`, `add-competitor`, `add-keywords`, `create`, `delete`, `get`, `get-ai-overview-trend`, `get-config-trend`, `get-keyword-history`, `get-latest-run`, `get-rank-movers`, `get-volatility-index`, `list-annotations`, `list-cannibalisation`, `list-competitors`, `list-configs`, `list-keyword-tags`, `remove-annotation`, `remove-competitor`, `remove-keywords`, `set-keyword-target-url`, `update`, `update-keyword-tag` | Trackers, keywords, tags, runs, trends, movers, annotations, cannibalisation, competitors. |
| `misarseo local-rank-grid` | `create-config`, `delete-config`, `get-latest-run`, `list-configs`, `run-check` | Geo-grid organic rank tracking. |
| `misarseo local-pack-rank` | `create-config`, `delete-config`, `get-latest-check`, `list-configs`, `run-check` | Local-pack position of a named business. |
| `misarseo brave-search` | `rank-check` | Rank checks against Brave Search's independent index. |

### Local

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo local` | `business-listings`, `nap-audit`, `questions-answers` | Business listings, Q&A and NAP audit. |
| `misarseo google-business-profile` | `available-locations`, `create-post`, `delete-review-reply`, `get-connection`, `get-optimization`, `get-performance`, `get-profile`, `link`, `list-posts`, `list-reviews`, `reply-to-review`, `unlink` | Business Profile connection, profile, performance, reviews, posts, optimization. |

### AI search visibility

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo ai-search` | `brand-lookup`, `brand-lookup-status`, `brand-scan-trend`, `citations`, `competitor-positioning`, `delete-brand-monitor`, `delete-tracked-prompt`, `list-brand-monitors`, `list-tracked-prompts`, `prompt-explorer`, `prompt-research`, `tracked-prompt-trend`, `upsert-brand-monitor`, `upsert-tracked-prompt` | Brand lookup, prompt explorer, brand monitors, tracked prompts, competitor positioning, prompt research, citations. |
| `misarseo direct-vendor-ai` | `answer` | Answers from vendors' own APIs (You.com, DeepSeek, xAI, Meta AI, MiniMax). |

### Search engines and analytics

| Resource | Methods | What it covers |
| --- | --- | --- |
| `misarseo gsc` | `anonymous-queries`, `archive`, `cannibalisation`, `connect`, `content-decay`, `coverage`, `ctr-by-position`, `hourly`, `inspect-urls`, `performance`, `sitemaps` | Search Console performance, archive, coverage, URL inspection, sitemaps, reports. |
| `misarseo ga4` | `channels`, `connect`, `daily`, `disconnect`, `landing-pages`, `list-properties`, `set-property` | Google Analytics 4 connection and reports. |
| `misarseo bing` | `backlinks`, `connect`, `detail-stats`, `disconnect`, `get-feed-details`, `keyword-research`, `list-sites`, `save-crawl-settings`, `set-site`, `site-overview`, `submit-content`, `submit-feed`, `update-blocked-url`, `update-query-parameter`, `url-info`, `url-links` | Bing Webmaster: site overview, backlinks, keyword research, submissions, settings. |
| `misarseo yandex` | `connect`, `disconnect`, `list-hosts`, `reindex-url`, `set-host`, `site-overview` | Yandex Webmaster: site overview, re-index, connection. |
| `misarseo baidu` | `connection`, `disconnect`, `set-connection`, `submit-urls` | Baidu push API connection and URL submission. |
| `misarseo index-now` | `submit` | IndexNow URL submission. |
| `misarseo ahrefs` | `connect`, `disconnect`, `list-projects`, `set-project` | Ahrefs Connect project selection (inert until partner approval). |


---

## Client

```bash
misarseo projects list --api-key mseo_… --base-url https://api.misar.io/seo
misarseo help rank-tracking        # arguments for every rank-tracking command
```

| Option | Default | Meaning |
| --- | --- | --- |
| base URL | `https://api.misar.io/seo` | API gateway. |
| timeout | 30 s | Per request; a stream's wait covers only the response headers. |
| max retries | 2 | Extra attempts for retryable failures (see [Retries](#retries)). |
| retry delays | 250 ms base, 60 s cap | Exponential backoff with jitter; `Retry-After` honoured up to the cap. |

---

## Quick start

```bash
misarseo projects list

misarseo keywords research --body '{"projectId":"<projectId>","keywords":["seo tools"]}'
```

---

## Primary functions

### Run a site audit and follow it live

```bash
misarseo crawl start --body '{"projectId":"<projectId>","startUrl":"https://example.com"}'

# one JSON frame per line: progress … then complete or error
misarseo crawl stream-events <jobId> <projectId>
```

### Read a backlink profile

```bash
misarseo backlinks overview <projectId> example.com --scope domain
```

---

## Errors

```bash
misarseo projects get nope
# Error 404 (NOT_FOUND): Project not found      (exit 1)
```

| Type | When |
| --- | --- |
| exit 1 | API or network error: `Error <status> (<code>): <message>` on stderr. |
| exit 2 | Unknown command, wrong number of arguments, missing key, invalid `--body`. |
| exit 3 | Plan limit: the server's upgrade card on stderr. |

### Plan limits

A call the organization's plan does not cover answers with

```json
{ "error": "...", "code": "plan_limit_exceeded", "upgrade": { "reason", "feature", "headline", "plans": [...], "urls": { "pricing" }, "cta" } }
```

- **402** — the feature is not in the plan, or a point-in-time cap (projects, API keys, tracked keywords) is reached.
- **429** with `Retry-After` — a day/month quota is spent; it resets at the period rollover.

Detection is by `code`, never by status: a quota block is a 429 and would otherwise look like an ordinary throttle. Every piece of copy — plan names, prices, what each plan unlocks, URLs — is in the offer, so render it rather than hard-coding any of it. `x-misar-plan` and `x-misar-upgrade-url` response headers carry the current plan and upgrade link.

```bash
misarseo keywords research --body '{"projectId":"p","keywords":["seo"]}'
# Plan limit reached: You've reached your Pro plan's limit of 250 keyword lookups per day.
#   * Business ($999.99/month) — 1,000 keyword lookups per day
# Upgrade to Business to continue.
# Upgrade: https://seo.misar.io/subscribe?plan=business      (exit 3)
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

```bash
misarseo backlinks anchors <projectId> example.com --page 2 --pageSize 50
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
