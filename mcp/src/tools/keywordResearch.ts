import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_keyword_research — expand seed keyword(s) into suggestions with metrics
 * (search volume, difficulty, CPC). Charges credits.
 */
export function registerKeywordResearchTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_keyword_research",
    "Expand ONE seed keyword into keyword suggestions with search volume, difficulty, and CPC for a MisarSEO project. " +
      "CHARGES CREDITS: one billable research run per call. " +
      "ONLY THE FIRST ENTRY of `keywords` is researched — `research()` takes `uniqueKeywords[0]` as the seed and the remaining entries only change the cache key, so a 20-seed call returns suggestions for the first seed alone. To research several seeds, make one call per seed and expect one charge each.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      keywords: z
        .array(z.string().min(1).max(500))
        .min(1)
        .max(100)
        .describe(
          "Seed keywords. Only the FIRST (after lower-casing and de-duplication) is researched; later entries are ignored. Pass one entry unless you have a reason to vary the cache key. Each entry is capped at 500 characters.",
        ),
      locationCode: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "DataForSEO location code. Omit it to use the project's default market, which falls back to 2840 (United States) for a project that has not set one.",
        ),
      languageCode: z
        .string()
        .min(2)
        .max(10)
        .optional()
        .describe("Language code (default 'en')."),
      resultLimit: z
        .union([z.literal(150), z.literal(300), z.literal(500)])
        .optional()
        .describe(
          "Max keywords returned for the seed: 150, 300, or 500 (default 150). Any other number is bucketed DOWN by the route rather than rejected.",
        ),
      mode: z
        .enum(["auto", "related", "suggestions", "ideas"])
        .optional()
        .describe(
          "Research mode (default 'auto'). An unrecognised value falls back to 'auto' rather than erroring.",
        ),
      clickstream: z
        .boolean()
        .optional()
        .describe(
          "Include clickstream-enriched volume data. Default FALSE — it doubles the upstream request cost, so it is opt-in.",
        ),
    },
    async ({
      projectId,
      keywords,
      locationCode,
      languageCode,
      resultLimit,
      mode,
      clickstream,
    }) => {
      const result = await client.post("/keywords/research", {
        projectId,
        keywords,
        locationCode,
        languageCode,
        resultLimit,
        mode,
        clickstream,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
