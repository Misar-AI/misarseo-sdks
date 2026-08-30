import { z } from "zod";
const DATE_RANGES = [
    "last_7_days",
    "last_28_days",
    "last_3_months",
    "last_6_months",
    "last_12_months",
    "last_16_months",
];
/**
 * seo_gsc_data — query Google Search Console performance data.
 */
export function registerGscTool(server, client) {
    server.tool("seo_gsc_data", "Query Google Search Console performance data for a MisarSEO project: clicks, impressions, CTR, and average position. Free — charges no credits. Requires GSC to be connected in the project settings.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        dateRange: z
            .enum(DATE_RANGES)
            .optional()
            .describe("Date range window (default 'last_28_days')."),
        dimensions: z
            .array(z.enum([
            "query",
            "page",
            "country",
            "device",
            "date",
            "searchAppearance",
        ]))
            .min(1)
            .max(4)
            .optional()
            .describe("Group rows by these dimensions (default ['query'])."),
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
            .max(1000)
            .optional()
            .describe("Max rows to return (default 1000)."),
    }, async ({ projectId, dateRange, dimensions, startDate, endDate, rowLimit, }) => {
        const result = await client.post("/gsc/performance", {
            projectId,
            dateRange,
            dimensions,
            startDate,
            endDate,
            rowLimit,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=gsc.js.map