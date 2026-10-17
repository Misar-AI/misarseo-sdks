# MisarSEO SDKs

Official client libraries for the [MisarSEO](https://seo.misar.io) API — keyword research, site audits, rank tracking, backlinks, AI search visibility, Search Console, GA4 and Business Profile.

Every SDK covers the full public surface: all 221 methods in 36 resource groups, plus the crawl progress SSE stream. Each is generated from [`manifest.json`](./manifest.json), which is itself generated from the API's OpenAPI route registry, and CI fails if any language falls behind it. They authenticate only with a MisarSEO API key (`mseo_…`, sent as a bearer token) and surface plan limits as a typed error carrying the server's upgrade offer.

## Install

| Language | Registry | Package | Source |
| --- | --- | --- | --- |
| TypeScript | npm | `@misarseo/sdk` | [`typescript/`](./typescript) |
| Python | PyPI | `misarseo` | [`python/`](./python) |
| Go | Go modules | `github.com/Misar-AI/misarseo-sdks/go` | [`go/`](./go) |
| Rust | crates.io | `misarseo` | [`rust/`](./rust) |
| Java | Maven Central | `io.misar:misarseo` | [`java/`](./java) |
| Kotlin | Maven Central | `io.misar:misarseo-kotlin` | [`kotlin/`](./kotlin) |
| Swift | Swift Package Manager | `MisarSEO` | [`swift/`](./swift) |
| Ruby | RubyGems | `misarseo` | [`ruby/`](./ruby) |
| PHP | Packagist | `misarai/misarseo-php` | [`php/`](./php) |
| .NET | NuGet | `MisarSEO` | [`csharp/`](./csharp) |
| Dart | pub.dev | `misarseo` | [`dart/`](./dart) |
| Flutter | pub.dev | `misarseo_flutter` | [`flutter/`](./flutter) |
| CLI | npm | `@misarseo/cli` | [`cli/`](./cli) |

Each directory has its own README with install, authentication, every resource and method, errors, plan limits, retries, pagination and streaming for that language.

## Releases

Versions are per SDK. A version bump in a language's own manifest (or, for Go, Swift and PHP, in [`VERSION`](./VERSION)) on `main` is tagged `<language>/vX.Y.Z` and that tag publishes to the registry. See [PUBLISHING.md](./PUBLISHING.md).

## License

MIT.
