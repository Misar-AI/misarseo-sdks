import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_rank_check — list the keywords tracked by ONE rank tracker config.
 *
 * The name is kept for backwards compatibility with published clients, but
 * `GET /rank-tracking/keywords` neither runs a check nor returns positions: it
 * reads `rank_tracking_keywords` rows for one config. Positions live in
 * `rank_snapshots` and are served by `GET /rank-tracking/runs`, which has no
 * tool here. The description says so rather than implying otherwise.
 */
export function registerRankCheckTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_rank_check",
    "List the keywords tracked by ONE rank tracker config: `{ keywords, totalCount, page, pageSize }`, where each keyword row is `{ id, configId, keyword, searchVolume, keywordDifficulty, cpc, metricsFetchedAt, createdAt }`. " +
      "DESPITE THE NAME IT DOES NOT RUN A RANK CHECK, and it returns NO positions — there is no `position`, `device` or SERP field on these rows. Checks run on the config's own schedule ('daily'/'weekly'), and the recorded positions are in `rank_snapshots`, which no tool in this server reads. Never report a keyword's rank from this response. " +
      "It also does NOT list the project's rank tracker configs; it describes the single config named by `configId`. " +
      "The `id` on each row is the tracking-keyword ID that seo_rank_keywords_remove and seo_rank_keyword_tags_update take. " +
      "FREE: database only, no SEO data provider is called and no credits are spent.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      configId: z
        .string()
        .min(1)
        .describe(
          "Rank tracker config ID. REQUIRED — the route 400s without it and there is no 'list every tracker' mode. Take it from seo_rank_tracker_create's `configId`, or read it from the rank tracking screen in the app.",
        ),
      page: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("1-based page number (default 1)."),
      pageSize: z
        .union([z.literal(50), z.literal(100), z.literal(250)])
        .optional()
        .describe(
          "Rows per page: 50, 100 or 250 (default 50). A tracker with more keywords than this is TRUNCATED silently — compare `keywords.length` against `totalCount` and page through the rest before concluding a keyword is not tracked.",
        ),
    },
    async ({ projectId, configId, page, pageSize }) => {
      const result = await client.get("/rank-tracking/keywords", {
        projectId,
        configId,
        page,
        pageSize,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
