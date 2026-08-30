# @misar/seo-mcp

MCP server for [MisarSEO](https://seo.misar.io) — gives AI assistants (Claude, Cursor, Windsurf, and any MCP-compatible client) direct access to keyword research, site crawl/audit, rank tracking, AI brand radar, and Google Search Console data.

## Quick start

```json
{
  "mcpServers": {
    "misarseo": {
      "command": "npx",
      "args": ["@misar/seo-mcp"],
      "env": {
        "MISARSEO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Get your API key from **seo.misar.io → Settings → API**.

## Tools

| Tool                      | Description                                                                                                              | Credits |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| `seo_list_projects`       | List your MisarSEO projects. Call this first to get a `projectId`.                                                       | Free    |
| `seo_keyword_research`    | Expand seed keywords into suggestions with volume, difficulty, and CPC.                                                  | Charged |
| `seo_crawl_site`          | Start a site crawl/audit. Returns an `auditId` to poll.                                                                  | Charged |
| `seo_get_crawl_results`   | Fetch results for a completed or in-progress crawl.                                                                      | Free    |
| `seo_rank_check`          | Get rank tracker configs and latest keyword position snapshots.                                                          | Free    |
| `seo_rank_tracker_create` | Create a new rank tracker for a set of keywords and a target URL.                                                        | Free    |
| `seo_ai_radar`            | Check brand/domain visibility in AI-generated answers (ChatGPT, Google AI Overviews).                                    | Charged |
| `seo_gsc_data`            | Query Google Search Console performance: clicks, impressions, CTR, position. Requires GSC connected in project settings. | Free    |

## Environment variables

| Variable           | Required | Default                    | Description                                |
| ------------------ | -------- | -------------------------- | ------------------------------------------ |
| `MISARSEO_API_KEY` | Yes      | —                          | API key from seo.misar.io → Settings → API |
| `MISARSEO_API_URL` | No       | `https://api.misar.io/seo` | Override for self-hosted or staging        |

## Usage pattern

Always call `seo_list_projects` first — every other tool requires a `projectId` returned from that call.

```
1. seo_list_projects           → pick a projectId
2. seo_keyword_research        → expand seed keywords
3. seo_crawl_site              → audit the site
4. seo_get_crawl_results       → read audit findings
5. seo_rank_check              → check current rankings
6. seo_ai_radar                → measure AI brand visibility
7. seo_gsc_data                → pull Search Console data
```

## Links

- Platform: [seo.misar.io](https://seo.misar.io)
- Docs: [docs.misar.io/seo](https://docs.misar.io/seo)
- Status: [status.misar.io](https://status.misar.io)

## License

MIT
