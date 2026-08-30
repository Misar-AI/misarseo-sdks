import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_rank_tracker_create — create a rank tracker config for a project.
 * Pair with seo_rank_check (read) and the rank-tracking keyword endpoints.
 */
export function registerRankTrackerCreateTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_rank_tracker_create",
    "Create a rank tracker config (domain + country + device + schedule) for a MisarSEO project. Returns `{ configId }`. " +
      "Next step is seo_rank_keywords_add with that configId. Positions are then collected by the SCHEDULED check ('daily' or 'weekly'); nothing in this server triggers a check on demand, and seo_rank_check only lists the tracked keywords — it neither runs a check nor returns positions. " +
      "One config per (domain, country) per project: repeating a pair returns a validation error rather than a second tracker. " +
      "FREE: database only, no SEO data provider is called and no credits are spent at creation time.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      domain: z
        .string()
        .min(1)
        .max(253)
        .describe(
          "Domain to track rankings for (e.g. 'acme.com'). A full URL is accepted and normalised down to its hostname; it must resolve to a real registrable domain.",
        ),
      serpDepth: z
        .number()
        .int()
        .min(10)
        .max(100)
        .multipleOf(10)
        .describe(
          "SERP scan depth, 10–100 in steps of 10 (e.g. 100). REQUIRED, and a value that is not a multiple of 10 is a 400.",
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
      devices: z
        .enum(["desktop", "mobile", "both"])
        .optional()
        .describe("Which devices to track (default 'both')."),
      scheduleInterval: z
        .enum(["daily", "weekly", "manual"])
        .optional()
        .describe("Auto-check cadence (default 'weekly')."),
    },
    async ({
      projectId,
      domain,
      serpDepth,
      locationCode,
      languageCode,
      devices,
      scheduleInterval,
    }) => {
      const result = await client.post<{ configId: string }>(
        "/rank-tracking/configs",
        {
          projectId,
          domain,
          serpDepth,
          locationCode,
          languageCode,
          devices,
          scheduleInterval,
        },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
