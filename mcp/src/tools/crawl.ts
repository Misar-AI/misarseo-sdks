import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_crawl_site — start a site crawl/audit.
 */
export function registerCrawlTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_crawl_site",
    "Start a MisarSEO site crawl/audit. Returns `{ jobId, auditId }` (the same id twice) with HTTP 202 — the crawl then runs in the background; poll it with seo_get_crawl_results. " +
      "FREE — charges no SEO credits. It does consume one of the organization's monthly audits from its plan quota, so do not start one speculatively.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      url: z
        .string()
        .url()
        .describe(
          "Root URL to crawl (e.g. 'https://example.com'). Must be http or https.",
        ),
      maxPages: z
        .number()
        .int()
        .positive()
        .max(5000)
        .optional()
        .describe(
          "Maximum pages to crawl, 1–5000 (above 5000 is a 400). Omitted means 50 — NOT the plan limit. Whatever is requested is then clamped DOWN to the plan tier's page ceiling, never up.",
        ),
    },
    async ({ projectId, url, maxPages }) => {
      const result = await client.post("/crawl/start", {
        projectId,
        // The tool's own argument stays `url` (it is the friendlier name for an
        // agent), but the wire field is `startUrl`, which is what the route has
        // always required.
        startUrl: url,
        maxPages,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
