# Changelog

All notable changes to this SDK are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-16

First release.

### Added

- The full MisarSEO API: 221 methods in 36 resource groups, generated from
  `manifest.json` (itself generated from the API's OpenAPI route registry),
  plus the crawl progress Server-Sent Events stream.
- Bearer API-key authentication (`mseo_…`), with the key read from
  `MISARSEO_API_KEY` where the platform has an environment.
- A plan-limit error carrying the server's upgrade offer (`code:
"plan_limit_exceeded"`; 402 for a locked feature or a point-in-time cap,
  429 with `Retry-After` for a spent quota), detected by code and never
  retried.
- The shared retry policy: 429 for every method, 502/503/504 and network
  failures for GET only, exponential backoff with jitter honouring
  `Retry-After` up to 60 s.
- Offset and cursor pagination helpers.
