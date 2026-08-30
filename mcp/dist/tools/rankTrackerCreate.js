import { z } from "zod";
/**
 * seo_rank_tracker_create — create a rank tracker config for a project.
 * Pair with seo_rank_check (read) and the rank-tracking keyword endpoints.
 */
export function registerRankTrackerCreateTool(server, client) {
    server.tool("seo_rank_tracker_create", "Create a rank tracker config (domain + country + schedule) for a MisarSEO project. After creating, add keywords and run a check with seo_rank_check.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        domain: z
            .string()
            .min(1)
            .describe("Domain to track rankings for (e.g. 'acme.com')."),
        serpDepth: z
            .number()
            .int()
            .min(10)
            .max(100)
            .describe("SERP scan depth, 10–100 in steps of 10 (e.g. 100)."),
        locationCode: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("DataForSEO location code (default 2840 = United States)."),
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
    }, async ({ projectId, domain, serpDepth, locationCode, languageCode, devices, scheduleInterval, }) => {
        const result = await client.post("/rank-tracking/configs", {
            projectId,
            domain,
            serpDepth,
            locationCode,
            languageCode,
            devices,
            scheduleInterval,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=rankTrackerCreate.js.map