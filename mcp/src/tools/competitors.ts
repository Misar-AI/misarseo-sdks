import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_competitors — SERP competitor discovery for a keyword set.
 */
export function registerCompetitorsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_competitors",
    "Find domains competing for a set of keywords in Google SERPs, with per-domain average position and keyword coverage. " +
      "CHARGES CREDITS: one SERP fetch per keyword, so the cost is the length of `keywords`. " +
      "`visibility`, `etv` and `rating` are null on deployments running the free data provider — no honest free equivalent exists, so they are left unmeasured rather than substituted. Null there does not mean zero.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      keywords: z
        .array(z.string().min(1).max(120))
        .min(1)
        .max(100)
        .describe(
          "Keywords whose SERPs are compared (1–100, each at most 120 characters). Every keyword is one billable SERP fetch.",
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
      excludeDomains: z
        .array(z.string().min(1).max(255))
        .min(1)
        .max(50)
        .optional()
        .describe(
          "Domains to exclude from results, e.g. your own site (1–50). Omit the field entirely to exclude nothing — an empty array is a 400, not 'no exclusions'.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum competitors to return (default 50, max 100)."),
    },
    async ({
      projectId,
      keywords,
      locationCode,
      languageCode,
      excludeDomains,
      limit,
    }) => {
      const result = await client.post("/competitors", {
        projectId,
        keywords,
        locationCode,
        languageCode,
        excludeDomains,
        limit,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
