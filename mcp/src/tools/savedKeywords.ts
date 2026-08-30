import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_saved_keywords_list — list keywords saved to a project.
 * seo_saved_keywords_save — save keywords to a project's keyword list.
 */
export function registerSavedKeywordsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_saved_keywords_list",
    "List keywords saved to a MisarSEO project, with cached metrics (volume, difficulty, CPC). Free — charges no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      search: z
        .string()
        .optional()
        .describe("Filter by keyword text (case-insensitive substring match)."),
      // `tagNames` and `pageSize` are the names the route reads. These were
      // `tags` and `limit`, which it reads nowhere: both were dropped and the
      // tool returned an unfiltered first page with a 200, so a request for
      // "50 rows tagged Priority" answered with 50 arbitrary rows.
      tagNames: z
        .array(z.string().min(1).max(64))
        .max(50)
        .optional()
        .describe(
          "Filter to keywords carrying ANY of these tag names (at most 50; more is a 400).",
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
          "Rows per page: 50, 100, or 250 (default 50). This is a page, not the whole list — page through with `page` before concluding a keyword is not saved.",
        ),
    },
    async ({ projectId, search, tagNames, page, pageSize }) => {
      const result = await client.get("/keywords/saved", {
        projectId,
        search,
        page,
        // An empty list must be sent as nothing: the route refuses a filter
        // that is present but holds no usable value rather than widening the
        // result set behind the caller's back.
        tagNames: tagNames?.length ? tagNames.join(",") : undefined,
        pageSize,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_saved_keywords_save",
    "Save keywords to a MisarSEO project's keyword list. Idempotent — duplicates are skipped. Free — charges no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      keywords: z
        .array(z.string().min(1).max(500))
        .min(1)
        .max(500)
        .describe(
          "Keywords to save (1–500 per call, each at most 500 characters). They are lower-cased and de-duplicated before storage.",
        ),
      tags: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Tags to APPEND to all saved keywords. Appending is the only mode this route has — existing tags on a keyword are never replaced or removed.",
        ),
      // `tagMode` was advertised here and did nothing: `restSaveKeywordsSchema`
      // has never declared it, so the route stripped it from every request and
      // `tagMode: "replace"` appended. Removing the parameter is not the same
      // as making it work — honouring it would change what a live endpoint
      // does to stored data.
    },
    async ({ projectId, keywords, tags }) => {
      const result = await client.post("/keywords/saved", {
        projectId,
        keywords,
        tags,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
