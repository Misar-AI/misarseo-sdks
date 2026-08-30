import { z } from "zod";
/**
 * seo_competitors — SERP competitor discovery for a keyword set.
 */
export function registerCompetitorsTool(server, client) {
    server.tool("seo_competitors", "Find domains competing for a set of keywords in Google SERPs, with per-domain average position and keyword coverage. Charges credits (~1 SERP fetch per keyword).", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        keywords: z
            .array(z.string().min(1))
            .min(1)
            .max(100)
            .describe("Keywords whose SERPs are compared (1–100)."),
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
        excludeDomains: z
            .array(z.string().min(1))
            .optional()
            .describe("Domains to exclude from results, e.g. your own site (up to 10)."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum competitors to return (default 50, max 100)."),
    }, async ({ projectId, keywords, locationCode, languageCode, excludeDomains, limit, }) => {
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
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=competitors.js.map