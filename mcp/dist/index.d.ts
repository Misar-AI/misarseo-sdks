#!/usr/bin/env node
/**
 * @misar/seo-mcp — MisarSEO standalone MCP server.
 *
 * Reads MISARSEO_API_KEY and MISARSEO_API_URL from the environment,
 * registers 20 SEO tools, and starts an stdio MCP transport.
 *
 * 20 tools across 17 register* functions: `savedKeywords`, `rankKeywords` and
 * `backlinks` each register a pair (list/save, add/remove, profile/anchors).
 * Counting the register calls instead of the `server.tool()` calls is what
 * previously put the wrong number here and in AGENTS.md.
 *
 * Usage (stdio transport, e.g. with Claude Desktop):
 *   MISARSEO_API_KEY=your_key npx @misar/seo-mcp
 *
 * Or in claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "misarseo": {
 *         "command": "npx",
 *         "args": ["@misar/seo-mcp"],
 *         "env": { "MISARSEO_API_KEY": "your_key" }
 *       }
 *     }
 *   }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Sandbox factory required by Smithery for capability scanning.
 * Uses placeholder credentials — no real API calls are made during the scan.
 * https://smithery.ai/docs/deploy#sandbox-server
 */
export declare function createSandboxServer(): McpServer;
//# sourceMappingURL=index.d.ts.map