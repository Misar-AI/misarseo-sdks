# Changelog

All notable changes to this SDK are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-16

Renamed from `@misar/seo` to **`@misarseo/sdk`**, the npm name every Misar
product's SDK follows. `@misar/seo` (0.1.x, never published to public npm) is
deprecated: replace the dependency and the import specifier — the API is
otherwise unchanged.

```diff
- import { MisarSeoClient } from "@misar/seo";
+ import { MisarSeoClient } from "@misarseo/sdk";
```

### Added

- `MisarSeoPlanLimitError` for `code: "plan_limit_exceeded"` (402 for a locked
  feature or a point-in-time cap, 429 with `Retry-After` for a spent quota):
  `offer`, `reason`, `feature`, `plan`, `upgradeUrl`, `retryAfterSeconds`.
  Detected by code before the status and never retried — a quota 429 used to
  be retried and then surfaced as `MisarSeoRateLimitError`.
- Full manifest coverage: `account.deleteViaPost`, `aiSearch.citations`,
  `team.listMembers`, `rankTracking.listCompetitors`,
  `rankTracking.addCompetitor`, `rankTracking.removeCompetitor`.

### Fixed

- `reportBuilder.deleteDefinition`, `reportBuilder.deleteSchedule`,
  `aiSearch.deleteBrandMonitor` and `aiSearch.deleteTrackedPrompt` sent
  `projectId` as a DELETE body the API never reads, so every call answered 400. It is now sent as a query parameter.
- `crawl.streamEvents` sends `Accept: text/event-stream`.

## [0.1.0]

Initial hand-written client, published as `@misar/seo`.
