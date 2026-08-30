import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

const DATE_RANGES = [
  "last_7_days",
  "last_28_days",
  "last_3_months",
  "last_6_months",
  "last_12_months",
  "last_16_months",
] as const;

/** Mirrors GSC_DIMENSIONS in src/server/features/gsc/searchAnalytics.ts. */
const DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "date",
  "searchAppearance",
] as const;

/** GSC_MAX_ROW_LIMIT — the route clamps to this rather than rejecting. */
const MAX_ROW_LIMIT = 1000;

/**
 * seo_gsc_data — query Google Search Console performance data.
 */
export function registerGscTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_gsc_data",
    "Query Google Search Console performance data for a MisarSEO project: clicks, impressions, CTR, and average position. " +
      "FREE — charges no credits. It reads the project's own connected Search Console property, but it does spend Google's per-property request quota, so it is rate limited per user. Requires Search Console to be connected in the project's settings. " +
      "`dateRange` and `startDate`/`endDate` are alternatives: send one or the other. Either way the range is clamped to Google's ~16-month floor, and the convenience ranges end ~3 days back for Search Console's data lag, so today and yesterday will not appear.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      dateRange: z
        .enum(DATE_RANGES)
        .optional()
        .describe("Date range window (default 'last_28_days')."),
      dimensions: z
        .array(z.enum(DIMENSIONS))
        .min(1)
        .max(DIMENSIONS.length)
        .optional()
        .describe(
          "Group rows by these dimensions (default ['query']). Unrecognised entries are dropped, and a list left holding nothing falls back to the default rather than erroring. Grouping by 'date' is also what archives the day's site-level metrics past Google's 16-month window.",
        ),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Explicit start date (YYYY-MM-DD). Use with endDate."),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Explicit end date (YYYY-MM-DD). Use with startDate."),
      rowLimit: z
        .number()
        .int()
        .min(1)
        .max(MAX_ROW_LIMIT)
        .optional()
        .describe(
          `Rows in this page of results, 1–${MAX_ROW_LIMIT} (default ${MAX_ROW_LIMIT}). Out-of-range values are clamped, not rejected.`,
        ),
      startRow: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          `0-based offset into the result set (default 0). Search Console holds far more than ${MAX_ROW_LIMIT} rows for most properties, so a full page means there are probably more — page with startRow = ${MAX_ROW_LIMIT}, ${2 * MAX_ROW_LIMIT}, … before concluding a query or page is absent.`,
        ),
    },
    async ({
      projectId,
      dateRange,
      dimensions,
      startDate,
      endDate,
      rowLimit,
      startRow,
    }) => {
      const result = await client.post("/gsc/performance", {
        projectId,
        dateRange,
        dimensions,
        startDate,
        endDate,
        rowLimit,
        startRow,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
