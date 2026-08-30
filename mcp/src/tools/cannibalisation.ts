import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

const WINDOWS = ["last_7_days", "last_28_days", "last_3_months"] as const;

const SORTS = ["impressions", "position_spread"] as const;

/**
 * seo_cannibalisation — queries where a site competes with itself.
 */
export function registerCannibalisationTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_cannibalisation",
    "Find queries where a project's own site competes with itself: two or more of its pages drawing impressions for the same query, splitting that query's clicks, click signals and ranking history. " +
      "FREE — charges no credits. It reads the project's connected Google Search Console property, which is first-party data and meters nothing; it does spend Google's own per-property request quota, so it is rate limited per user. Requires Search Console to be connected in the project's settings. " +
      "The response is ONE of four states, and they are four different facts — read `state` before anything else: " +
      "`not_connected` (no property is bound to this project — tell the user to connect one; do not report a clean result); " +
      "`requires_reconnect` (a property is bound but its Google grant was revoked or expired — tell the user to reconnect); " +
      "`no_search_data` (Search Console returned nothing for the window — an absence of data, NOT a clean bill of health); " +
      "`analysed` (we looked: `findings` may legitimately be empty, and `coverage` is the proof — it reports the queries and (query, page) rows scanned, and `truncated: true` when the property had more rows than one report can fetch, meaning findings may have been missed). " +
      "Never turn any of the first three into 'no cannibalisation found'. " +
      "Each finding lists the competing pages with Search Console's own clicks / impressions / CTR / average position for that (query, page) pair, plus `positionSpread` and `excludedLowVolumePages` (pages that appeared for the query but fell under the per-page impression floor). `thresholds` is returned with every analysed report, so you can say whether a threshold rather than the absence of a problem is why a query is missing. Up to 200 findings; `totalFindings` is the real count.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      window: z
        .enum(WINDOWS)
        .optional()
        .describe(
          "Analysis window (default 'last_28_days'). Capped at three months on purpose — Search Console's longer ranges are NOT offered here, because over a long window 'two pages received impressions' also describes a page migration, and reporting that as cannibalisation sends someone to consolidate pages that are already consolidated. The window end is backed off ~3 days for Search Console's data lag.",
        ),
      sort: z
        .enum(SORTS)
        .optional()
        .describe(
          "Finding order (default 'impressions'). 'impressions' = most affected search demand first. 'position_spread' = smallest gap between the competing pages' average positions first, i.e. the pages Google rated as most interchangeable. Both are single measured quantities; there is deliberately no composite severity score.",
        ),
    },
    async ({ projectId, window, sort }) => {
      const result = await client.post("/gsc/cannibalisation", {
        projectId,
        window,
        sort,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
