# SDK Publishing Guide

Everything publishes from the GitHub mirror,
**[github.com/Misar-AI/misarseo-sdks](https://github.com/Misar-AI/misarseo-sdks)**,
which is populated from this repository by `.forgejo/workflows/sync-sdks-to-github.yml`
on every push to `main`. The mirror keeps each language at its **root** —
`typescript/`, `go/`, … — not under `sdks/`, plus `manifest.json`,
`Package.swift`, `VERSION` and the release scripts.

Nothing here publishes from Forgejo: no registry credential lives in this
repository, and the monorepo CI only tests.

## The gate

Nothing publishes until the repository variable `SDK_PUBLISH_TARGETS` is set on
the mirror. Unset (the default) means `auto-tag.yml` reports what it would have
tagged and stops. Set it to a single language first, confirm that package on its
registry, then widen:

```
unset / empty   nothing is tagged; dry run
python,rust     only those two
all             every changed SDK
```

A sync touching every SDK directory would otherwise release thirteen packages at
once, and a published version can never be replaced — npm's unpublish window is
72 hours, crates.io and the Go module proxy are immutable, Maven Central has no
delete at all. `scripts/check-sdk-release.mjs` runs before any credential is
touched and refuses a tag that disagrees with its manifest.

## Tags and registries

Tagging is releasing: `publish.yml` on the mirror runs on the tag `auto-tag.yml`
creates. `scripts/sdk-versions.mjs` reads every declared version and
`scripts/sdk-release-plan.mjs` decides which changed.

| SDK        | Tag                 | Registry           | Identifier                             |
| ---------- | ------------------- | ------------------ | -------------------------------------- |
| TypeScript | `typescript/v1.0.0` | npm                | `@misarseo/sdk`                        |
| CLI        | `cli/v1.0.0`        | npm                | `@misarseo/cli`                        |
| Python     | `python/v1.0.0`     | PyPI               | `misarseo`                             |
| Rust       | `rust/v1.0.0`       | crates.io          | `misarseo`                             |
| Ruby       | `ruby/v1.0.0`       | RubyGems           | `misarseo`                             |
| C#         | `csharp/v1.0.0`     | NuGet              | `MisarSEO`                             |
| Java       | `java/v1.0.0`       | Maven Central      | `io.misar:misarseo`                    |
| Kotlin     | `kotlin/v1.0.0`     | Maven Central      | `io.misar:misarseo-kotlin`             |
| Dart       | `dart/v1.0.0`       | pub.dev            | `misarseo`                             |
| Flutter    | `flutter/v1.0.0`    | pub.dev            | `misarseo_flutter`                     |
| Go         | `go/v1.0.0`         | Go module proxy    | `github.com/Misar-AI/misarseo-sdks/go` |
| PHP        | `php/v1.0.0`        | Packagist          | `misarai/misarseo-php`                 |
| Swift      | `swift/v1.0.0`      | SwiftPM (git tags) | `MisarSEO`                             |

Go, Swift and PHP versions come from `sdks/VERSION`; every other SDK's from its
own manifest.

## Go, PHP and Swift do not publish to a registry

**Go** has no registry. The module proxy resolves straight from the mirror, so
the `go/v1.0.0` tag is the release. The module path is
`github.com/Misar-AI/misarseo-sdks/go` — a `/v1` suffix is not allowed (Go
reserves major-version suffixes for v2+), and v2 and later will need
`…/go/v2`.

**Swift** resolves from the mirror root, which is why `sdks/Package.swift`
exists and points into `swift/`.

**PHP** — Packagist reads `composer.json` from a repository root, so the mirror
splits `php/` to `Misar-AI/misarseo-php` on a `php/v*` tag (needs `SPLIT_TOKEN`).

## Secrets on the mirror

Set on `Misar-AI/misarseo-sdks` → Settings → Secrets → Actions.

| Secret                                            | Used by                                |
| ------------------------------------------------- | -------------------------------------- |
| `NPM_TOKEN`                                       | npm (`@misarseo/sdk`, `@misarseo/cli`) |
| `PYPI_API_TOKEN`                                  | PyPI                                   |
| `CARGO_REGISTRY_TOKEN`                            | crates.io                              |
| `RUBYGEMS_API_KEY`                                | RubyGems                               |
| `NUGET_API_KEY`                                   | NuGet                                  |
| `OSSRH_USERNAME`, `OSSRH_TOKEN`                   | Maven Central                          |
| `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE`, `GPG_KEY_ID` | Maven Central signing                  |
| `PUB_CREDENTIALS`                                 | pub.dev                                |
| `PACKAGIST_USERNAME`, `PACKAGIST_API_TOKEN`       | Packagist sync                         |
| `SPLIT_TOKEN`                                     | pushing to the PHP standalone repo     |

## One-time registry setup

- **npm** — org `misarseo`; token with publish access. Deprecate the old
  `@misar/seo` name if it was ever published.
- **PyPI** — the project must exist before a token can publish to it.
- **crates.io** — sign in with GitHub, generate a token.
- **RubyGems** — the first `gem push` needs email confirmation.
- **pub.dev** — publish `misarseo` (Dart) before `misarseo_flutter`.
- **NuGet** — key scoped to `MisarSEO`.
- **Maven Central** — the `io.misar` namespace is already verified.
- **Packagist** — submit `https://github.com/Misar-AI/misarseo-php`.

## MCP server

`@misarseo/mcp` is built and published from `misar-io/packages/seo-mcp-server`
and is **not** part of this pipeline. This repository holds only the thin route
that serves it at `/mcp`, `/api/mcp` and `api.misar.io/seo/mcp`.
