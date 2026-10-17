# MisarSEO Python SDK

> Keyword research, site audits, rank tracking and AI search visibility from Python.

[![PyPI](https://img.shields.io/pypi/v/misarseo)](https://pypi.org/project/misarseo/)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**36 resource groups · 221 methods · SSE crawl streaming · `httpx` the only dependency**

MisarSEO is one API for the SEO work around a site: keyword and competitor research, crawls and audits, rank tracking (organic, local and AI Overviews), backlinks, AI-search brand visibility, and the data Google Search Console, GA4, Bing, Yandex and Baidu hold about it. Python 3.9+. Every method returns the decoded JSON body.

Package: `misarseo` on PyPI. Source: [github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks/tree/main/python).

---

## Install

### pip

```bash
pip install misarseo
```

### uv

```bash
uv add misarseo
```

---

## Authentication

Create an API key as described at https://seo.misar.io/ai. It starts with `mseo_` and is sent as `Authorization: Bearer mseo_…` — the only credential the SDK uses.

Every call is decided server-side against the plan of the organization that owns the key; there is no client-side limit checking. A plan refusal carries `code: "plan_limit_exceeded"` and an upgrade offer, and is never retried (see [Plan limits](#plan-limits)).

```python
import os
from misarseo import MisarSeoClient

seo = MisarSeoClient(os.environ["MISARSEO_API_KEY"])
```

---

## Resources

Every group the client exposes, and every method on it — generated from [`manifest.json`](./manifest.json), the same file every MisarSEO SDK is built from. Positional arguments are path parameters then required query parameters (snake_case); `body` is the JSON body; `query` takes optional query parameters.

### Workspace

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.projects` | `create`, `delete`, `get`, `list`, `update` | Projects in the organization: list, create, rename, archive. |
| `seo.team` | `list_members` | Members, pending invitations and the caller's role (read-only). |
| `seo.account` | `delete`, `delete_via_post`, `export` | Data-subject rights: full JSON export and account erasure. |
| `seo.activity` | `list` | The organization's activity log, newest first (cursor paged). |
| `seo.usage` | `get` | Plan tier, credits and quota usage for the organization. |
| `seo.dashboard` | `get` | Cross-project overview — one card per active project. |
| `seo.portfolios` | `add_projects`, `create`, `delete`, `get`, `list`, `remove_projects`, `rename` | Group projects and read their aggregate summary. |
| `seo.report_builder` | `create_definition`, `delete_definition`, `delete_schedule`, `get_definition`, `get_schedule`, `list_definitions`, `rename_definition`, `render_definition`, `set_widgets`, `upsert_schedule` | User-composed report definitions, widgets, rendering and schedules. |

### Keyword and competitive research

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.keywords` | `classify_intent`, `gap`, `list_saved`, `list_share_of_voice`, `potential`, `research`, `save`, `serp_overview`, `strategy`, `topic_research` | Keyword research, saved keywords, intent, SERP overview, gap, topic research, strategy, share of voice. |
| `seo.domain` | `authority_history`, `batch_overview`, `capture_authority_snapshot`, `overview` | Domain overview, batch overview and authority history. |
| `seo.backlinks` | `anchors`, `intersect`, `overview` | Backlink profile, anchors (offset paged) and link intersect. |
| `seo.competitors` | `find` | SERP competitor discovery. |
| `seo.content` | `optimizer`, `page_metrics` | On-page content optimizer and page metrics. |
| `seo.mentions` | `media_monitoring`, `unlinked_mentions` | Unlinked brand mentions and media monitoring. |
| `seo.competitor_monitor` | `add_target`, `list_changes`, `list_targets`, `remove_target` | Competitor page change detection. |
| `seo.link_building` | `add`, `add_note`, `export_csv`, `import_csv`, `list`, `list_activity`, `remove`, `update`, `update_status` | Prospect list, outreach status, activity log, CSV import/export. |
| `seo.disavow` | `add`, `export`, `list`, `remove` | Disavow entries and Google's disavow-file export. |

### Site audit

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.crawl` | `clear_issue_status`, `comparison`, `core_web_vitals`, `create_audit_segment`, `create_custom_issue_rule`, `create_issue_mute_rule`, `create_issue_severity_override`, `delete_audit_segment`, `delete_custom_issue_rule`, `delete_issue_mute_rule`, `delete_issue_severity_override`, `https_report`, `internal_links`, `list_audit_segments`, `list_custom_issue_rules`, `list_issue_mute_rules`, `list_issue_severity_overrides`, `list_issue_statuses`, `segment`, `set_issue_status`, `start`, `status`, `structured_data_report`, `stream_events` (SSE) | Start a crawl, read status and comparisons, Core Web Vitals, triage rules, audit reports, and the live SSE progress stream. |
| `seo.patches` | `batch_draft`, `disable_auto_publish`, `draft`, `enable_auto_publish`, `list`, `list_auto_publish_rules`, `publish`, `revert` | AI-drafted title/meta/canonical patches, publish/revert and auto-publish rules. |
| `seo.log_analyzer` | `daily_summary`, `get_upload`, `list_uploads`, `top_paths`, `upload` | Server-log uploads and bot-traffic reports. |
| `seo.web_analytics` | `devices`, `sources`, `summary`, `top_pages` | First-party, cookieless traffic and AI-referral reports. |

### Rank tracking

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.rank_tracking` | `add_annotation`, `add_competitor`, `add_keywords`, `create`, `delete`, `get`, `get_ai_overview_trend`, `get_config_trend`, `get_keyword_history`, `get_latest_run`, `get_rank_movers`, `get_volatility_index`, `list_annotations`, `list_cannibalisation`, `list_competitors`, `list_configs`, `list_keyword_tags`, `remove_annotation`, `remove_competitor`, `remove_keywords`, `set_keyword_target_url`, `update`, `update_keyword_tag` | Trackers, keywords, tags, runs, trends, movers, annotations, cannibalisation, competitors. |
| `seo.local_rank_grid` | `create_config`, `delete_config`, `get_latest_run`, `list_configs`, `run_check` | Geo-grid organic rank tracking. |
| `seo.local_pack_rank` | `create_config`, `delete_config`, `get_latest_check`, `list_configs`, `run_check` | Local-pack position of a named business. |
| `seo.brave_search` | `rank_check` | Rank checks against Brave Search's independent index. |

### Local

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.local` | `business_listings`, `nap_audit`, `questions_answers` | Business listings, Q&A and NAP audit. |
| `seo.google_business_profile` | `available_locations`, `create_post`, `delete_review_reply`, `get_connection`, `get_optimization`, `get_performance`, `get_profile`, `link`, `list_posts`, `list_reviews`, `reply_to_review`, `unlink` | Business Profile connection, profile, performance, reviews, posts, optimization. |

### AI search visibility

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.ai_search` | `brand_lookup`, `brand_lookup_status`, `brand_scan_trend`, `citations`, `competitor_positioning`, `delete_brand_monitor`, `delete_tracked_prompt`, `list_brand_monitors`, `list_tracked_prompts`, `prompt_explorer`, `prompt_research`, `tracked_prompt_trend`, `upsert_brand_monitor`, `upsert_tracked_prompt` | Brand lookup, prompt explorer, brand monitors, tracked prompts, competitor positioning, prompt research, citations. |
| `seo.direct_vendor_ai` | `answer` | Answers from vendors' own APIs (You.com, DeepSeek, xAI, Meta AI, MiniMax). |

### Search engines and analytics

| Resource | Methods | What it covers |
| --- | --- | --- |
| `seo.gsc` | `anonymous_queries`, `archive`, `cannibalisation`, `connect`, `content_decay`, `coverage`, `ctr_by_position`, `hourly`, `inspect_urls`, `performance`, `sitemaps` | Search Console performance, archive, coverage, URL inspection, sitemaps, reports. |
| `seo.ga4` | `channels`, `connect`, `daily`, `disconnect`, `landing_pages`, `list_properties`, `set_property` | Google Analytics 4 connection and reports. |
| `seo.bing` | `backlinks`, `connect`, `detail_stats`, `disconnect`, `get_feed_details`, `keyword_research`, `list_sites`, `save_crawl_settings`, `set_site`, `site_overview`, `submit_content`, `submit_feed`, `update_blocked_url`, `update_query_parameter`, `url_info`, `url_links` | Bing Webmaster: site overview, backlinks, keyword research, submissions, settings. |
| `seo.yandex` | `connect`, `disconnect`, `list_hosts`, `reindex_url`, `set_host`, `site_overview` | Yandex Webmaster: site overview, re-index, connection. |
| `seo.baidu` | `connection`, `disconnect`, `set_connection`, `submit_urls` | Baidu push API connection and URL submission. |
| `seo.index_now` | `submit` | IndexNow URL submission. |
| `seo.ahrefs` | `connect`, `disconnect`, `list_projects`, `set_project` | Ahrefs Connect project selection (inert until partner approval). |


---

## Client

```python
MisarSeoClient(
    "mseo_…",
    base_url="https://api.misar.io/seo",  # default
    timeout=30.0,
    max_retries=2,
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

```python
project_id = seo.projects.list()["projects"][0]["id"]

ideas = seo.keywords.research({"projectId": project_id, "keywords": ["seo tools"]})
```

---

## Primary functions

### Run a site audit and follow it live

```python
job = seo.crawl.start({"projectId": project_id, "startUrl": "https://example.com"})

for frame in seo.crawl.stream_events(job["jobId"], project_id):
    print(frame["event"], frame["data"])  # progress … then complete or error
```

### Read a backlink profile

```python
profile = seo.backlinks.overview(project_id, "example.com")
```

---

## Errors

```python
from misarseo import MisarSeoError, MisarSeoNotFoundError

try:
    seo.projects.get("nope")
except MisarSeoNotFoundError as e:
    print(e.code)  # "NOT_FOUND"
except MisarSeoError as e:
    print(e.status, e.code, e.message)
```

| Type | When |
| --- | --- |
| `MisarSeoError` | Base: `status`, `code`, `message`, `body`. |
| `MisarSeoPlanLimitError` | `offer`, `reason`, `feature`, `plan`, `upgrade_url`, `retry_after`. |
| `MisarSeoValidationError` … `MisarSeoNotFoundError` | 400 / 401 / 402 / 403 / 404. |
| `MisarSeoRateLimitError` | 429 throttle, with `retry_after`. |
| `MisarSeoUpstreamError` / `MisarSeoNetworkError` | 502–504 / no response. |

### Plan limits

A call the organization's plan does not cover answers with

```json
{ "error": "...", "code": "plan_limit_exceeded", "upgrade": { "reason", "feature", "headline", "plans": [...], "urls": { "pricing" }, "cta" } }
```

- **402** — the feature is not in the plan, or a point-in-time cap (projects, API keys, tracked keywords) is reached.
- **429** with `Retry-After` — a day/month quota is spent; it resets at the period rollover.

Detection is by `code`, never by status: a quota block is a 429 and would otherwise look like an ordinary throttle. Every piece of copy — plan names, prices, what each plan unlocks, URLs — is in the offer, so render it rather than hard-coding any of it. `x-misar-plan` and `x-misar-upgrade-url` response headers carry the current plan and upgrade link.

```python
from misarseo import MisarSeoPlanLimitError

try:
    seo.keywords.research({"projectId": project_id, "keywords": ["seo"]})
except MisarSeoPlanLimitError as e:
    print(e.offer["headline"], e.upgrade_url)
    for plan in e.offer["plans"]:
        print(plan["name"], plan["price"], plan["unlocks"])
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

```python
from misarseo import iterate_offset_pages

for anchor in iterate_offset_pages(
    lambda page: seo.backlinks.anchors(project_id, "example.com", query={"page": page})
):
    print(anchor)
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
