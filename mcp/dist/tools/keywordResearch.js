import { z } from "zod";
/**
 * seo_keyword_research — expand seed keyword(s) into suggestions with metrics
 * (search volume, difficulty, CPC). Charges credits.
 */
export function registerKeywordResearchTool(server, client) {
    server.tool("seo_keyword_research", "Expand seed keyword(s) into keyword suggestions with search volume, difficulty, and CPC for a MisarSEO project. Charges credits — keep seed lists focused.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        keywords: z
            .array(z.string().min(1))
            .min(1)
            .max(100)
            .describe("Seed keyword(s); the first is treated as primary."),
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
        resultLimit: z
            .union([z.literal(150), z.literal(300), z.literal(500)])
            .optional()
            .describe("Max keywords per seed: 150, 300, or 500 (default 150)."),
        mode: z
            .enum(["auto", "related", "suggestions", "ideas"])
            .optional()
            .describe("Research mode (default 'auto')."),
        clickstream: z
            .boolean()
            .optional()
            .describe("Include clickstream-enriched volume data (default true)."),
    }, async ({ projectId, keywords, locationCode, languageCode, resultLimit, mode, clickstream, }) => {
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
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=keywordResearch.js.map