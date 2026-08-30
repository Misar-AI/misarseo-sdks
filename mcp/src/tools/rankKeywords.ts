import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_rank_keywords_add — add keywords to a rank tracker config.
 * seo_rank_keywords_remove — remove keywords from a rank tracker config.
 */
export function registerRankKeywordsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_rank_keywords_add",
    "Add keywords to an existing rank tracker config. Returns `{ added, addedIds }` — `added` counts the rows actually inserted after keywords already tracked on this config are dropped, so it can legitimately be lower than the number submitted, and 0 means every one was already tracked. " +
      "Positions are NOT available afterwards: they are collected by the config's scheduled check, and seo_rank_check lists the tracked keywords without any position field. " +
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
          "Rank tracker config ID. Use seo_rank_tracker_create to create one.",
        ),
      keywords: z
        .array(z.string().min(1).max(500))
        .min(1)
        .max(100)
        .describe(
          "Keywords to track (1–100 per call, each at most 500 characters). Lower-cased and trimmed; entries already tracked on this config are skipped.",
        ),
    },
    async ({ projectId, configId, keywords }) => {
      const result = await client.post("/rank-tracking/keywords", {
        projectId,
        configId,
        keywords,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_rank_keywords_remove",
    "Remove keywords from a rank tracker config by their tracking-keyword IDs. Past position snapshots are deliberately kept, so history for a removed keyword survives. " +
      "FREE: database only, no SEO data provider is called and no credits are spent.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      configId: z.string().min(1).describe("Rank tracker config ID."),
      keywordIds: z
        .array(z.string().min(1))
        .min(1)
        .max(1000)
        .describe(
          "Tracking-keyword IDs to remove (1–1000): `addedIds` from seo_rank_keywords_add, or the `id` on each row from seo_rank_check. Not keyword text and not saved-keyword IDs.",
        ),
    },
    async ({ projectId, configId, keywordIds }) => {
      const result = await client.delete("/rank-tracking/keywords", {
        projectId,
        configId,
        keywordIds,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
