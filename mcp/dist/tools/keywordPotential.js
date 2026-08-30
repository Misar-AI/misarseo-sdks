import { z } from "zod";
/**
 * seo_keyword_potential — Parent Topic and Traffic Potential for one keyword.
 */
export function registerKeywordPotentialTool(server, client) {
    server.tool("seo_keyword_potential", "Get the Parent Topic and Traffic Potential of a single keyword: the broader term the page currently winning this keyword actually ranks for, and the total estimated traffic that page pulls across every keyword it ranks for. Use it to decide whether to target a keyword directly or the broader topic above it. Charges credits (~2 upstream calls per keyword), so look keywords up one at a time rather than sweeping a research list.", {
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
            .describe("DataForSEO location code (default 2840 = United States)."),
        languageCode: z
            .string()
            .min(2)
            .max(8)
            .optional()
            .describe("Language code (default 'en')."),
    }, async ({ projectId, keyword, locationCode, languageCode }) => {
        const result = await client.get("/keywords/potential", {
            projectId,
            keyword,
            locationCode,
            languageCode,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=keywordPotential.js.map