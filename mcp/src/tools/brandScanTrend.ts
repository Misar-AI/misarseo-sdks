import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_brand_scan_trend — recorded AI-visibility history for one target.
 */
export function registerBrandScanTrendTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_brand_scan_trend",
    "Get the recorded AI-visibility history for a brand or domain: mentions, cited sources, and competitors seen at each past scan, oldest first. Answers whether visibility in AI answers is moving, which a single seo_ai_radar scan cannot. Returns only scans that actually ran — the series is empty for a target never scanned and fills in as seo_ai_radar runs, with nothing interpolated or back-filled. Free — charges no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      target: z
        .string()
        .min(1)
        .max(250)
        .describe(
          "Brand or domain to look up, matched case-insensitively after trimming (e.g. 'Acme' or 'acme.com'). Must match the `brand` a seo_ai_radar scan was run with. At most 250 characters.",
        ),
      since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Inclusive lower bound as YYYY-MM-DD. Omit for all history."),
    },
    async ({ projectId, target, since }) => {
      const result = await client.get("/ai/brand-scan-trend", {
        projectId,
        target,
        since,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
