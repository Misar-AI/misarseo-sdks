#!/usr/bin/env node
/**
 * @misar/seo-mcp — MisarSEO standalone MCP server.
 *
 * Reads MISARSEO_API_KEY and MISARSEO_API_URL from the environment,
 * registers 29 SEO tools, and starts an stdio MCP transport.
 *
 * 29 tools across 22 register* functions: `savedKeywords`, `rankKeywords`,
 * `backlinks`, `rankKeywordTags` and `logAnalyzer` each register a pair or
 * more (list/save, add/remove, profile/anchors, list/update, and the four
 * log-analyzer tools). Counting the register calls instead of the
 * `server.tool()` calls is what previously put the wrong number here and in
 * AGENTS.md.
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
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MisarSeoClient } from "./client.js";
import { registerListProjectsTool } from "./tools/listProjects.js";
import { registerKeywordResearchTool } from "./tools/keywordResearch.js";
import { registerCrawlTool } from "./tools/crawl.js";
import { registerCrawlResultsTool } from "./tools/crawlResults.js";
import { registerRankCheckTool } from "./tools/rankCheck.js";
import { registerRankTrackerCreateTool } from "./tools/rankTrackerCreate.js";
import { registerAiRadarTool } from "./tools/aiRadar.js";
import { registerGscTool } from "./tools/gsc.js";
import { registerDomainOverviewTool } from "./tools/domainOverview.js";
import { registerBacklinksTool } from "./tools/backlinks.js";
import { registerCompetitorsTool } from "./tools/competitors.js";
import { registerPromptExplorerTool } from "./tools/promptExplorer.js";
import { registerSavedKeywordsTool } from "./tools/savedKeywords.js";
import { registerRankKeywordsTool } from "./tools/rankKeywords.js";
import { registerKeywordPotentialTool } from "./tools/keywordPotential.js";
import { registerAuditComparisonTool } from "./tools/auditComparison.js";
import { registerBrandScanTrendTool } from "./tools/brandScanTrend.js";
import { registerKeywordGapTool } from "./tools/keywordGap.js";
import { registerCannibalisationTool } from "./tools/cannibalisation.js";
import { registerLinkIntersectTool } from "./tools/linkIntersect.js";
import { registerRankKeywordTagsTool } from "./tools/rankKeywordTags.js";
import { registerLogAnalyzerTool } from "./tools/logAnalyzer.js";

const DEFAULT_API_URL = "https://api.misar.io/seo";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[misarseo-mcp] Error: ${name} environment variable is required.`,
    );
    process.exit(1);
  }
  return value;
}

/** Build and register every MisarSEO tool onto an McpServer instance. */
function buildServer(apiKey: string, apiUrl: string): McpServer {
  const client = new MisarSeoClient(apiKey, apiUrl);

  const server = new McpServer(
    {
      name: "MisarSEO",
      version: "0.3.0",
    },
    {
      instructions:
        "MisarSEO SEO research tools. Always call seo_list_projects first to get a projectId, then use the other tools. Some tools charge credits — proceed with focused research and ask for confirmation before large batches.",
    },
  );

  // seo_list_projects first — it's the entry point every other tool needs a
  // projectId from. Keep this list and the count in AGENTS.md in step.
  registerListProjectsTool(server, client);
  registerKeywordResearchTool(server, client);
  registerCrawlTool(server, client);
  registerCrawlResultsTool(server, client);
  registerRankCheckTool(server, client);
  registerRankTrackerCreateTool(server, client);
  registerAiRadarTool(server, client);
  registerGscTool(server, client);
  registerDomainOverviewTool(server, client);
  registerBacklinksTool(server, client);
  registerCompetitorsTool(server, client);
  registerPromptExplorerTool(server, client);
  registerSavedKeywordsTool(server, client);
  registerRankKeywordsTool(server, client);
  registerKeywordPotentialTool(server, client);
  registerAuditComparisonTool(server, client);
  registerBrandScanTrendTool(server, client);
  registerKeywordGapTool(server, client);
  registerCannibalisationTool(server, client);
  registerLinkIntersectTool(server, client);
  registerRankKeywordTagsTool(server, client);
  registerLogAnalyzerTool(server, client);

  return server;
}

/**
 * Sandbox factory required by Smithery for capability scanning.
 * Uses placeholder credentials — no real API calls are made during the scan.
 * https://smithery.ai/docs/deploy#sandbox-server
 */
export function createSandboxServer(): McpServer {
  return buildServer("sandbox-key", DEFAULT_API_URL);
}

async function main(): Promise<void> {
  const apiKey = getRequiredEnv("MISARSEO_API_KEY");
  const apiUrl = process.env["MISARSEO_API_URL"] ?? DEFAULT_API_URL;

  const server = buildServer(apiKey, apiUrl);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the process alive (stdio transport blocks on stdin)
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

// Auto-start only when MISARSEO_API_KEY is present (i.e. a real runtime).
// When Smithery's scan bundle imports this module without credentials, it will
// call createSandboxServer() directly — main() must not exit the process then.
if (process.env["MISARSEO_API_KEY"]) {
  main().catch((err: unknown) => {
    console.error("[misarseo-mcp] Fatal error:", err);
    process.exit(1);
  });
}
