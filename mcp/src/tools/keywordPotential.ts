import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_keyword_potential — Parent Topic and Traffic Potential for one keyword.
 */
export function registerKeywordPotentialTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_keyword_potential",
    "Get the Parent Topic and Traffic Potential of a single keyword: the broader term the page currently winning this keyword actually ranks for, and the total estimated traffic that page pulls across every keyword it ranks for. Use it to decide whether to target a keyword directly or the broader topic above it. " +
      "CHARGES CREDITS: exactly two billable upstream calls per keyword (one SERP fetch, then one ranked-keywords lookup for the winning page). Look keywords up one at a time rather than sweeping a research list. The result is cached for 30 days on (keyword, location, language), so repeating a lookup within that window is free. " +
      "Requires a paid plan — Traffic Potential comes from a paid traffic model with no free equivalent, so a free-plan organization gets PAYMENT_REQUIRED, and a deployment on the free data provider gets 501 SEO_DATA_UNAVAILABLE from the ranked-keywords step. " +
      "A keyword whose SERP has no organic result returns SEO_DATA_UNAVAILABLE rather than zeros: there is no page to derive anything from, which is not the same as a potential of 0.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      keyword: z.string().min(1).describe("The keyword to analyse."),
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
        .max(8)
        .optional()
        .describe("Language code (default 'en')."),
    },
    async ({ projectId, keyword, locationCode, languageCode }) => {
      const result = await client.get("/keywords/potential", {
        projectId,
        keyword,
        locationCode,
        languageCode,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
