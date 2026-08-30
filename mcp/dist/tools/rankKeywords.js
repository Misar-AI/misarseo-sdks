import { z } from "zod";
/**
 * seo_rank_keywords_add — add keywords to a rank tracker config.
 * seo_rank_keywords_remove — remove keywords from a rank tracker config.
 */
export function registerRankKeywordsTool(server, client) {
    server.tool("seo_rank_keywords_add", "Add keywords to an existing rank tracker config. After adding, run seo_rank_check to see positions. Free — charges no credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        configId: z
            .string()
            .min(1)
            .describe("Rank tracker config ID. Use seo_rank_tracker_create to create one."),
        keywords: z
            .array(z.string().min(1))
            .min(1)
            .max(100)
            .describe("Keywords to track (1–100 per call). Duplicates are skipped."),
    }, async ({ projectId, configId, keywords }) => {
        const result = await client.post("/rank-tracking/keywords", {
            projectId,
            configId,
            keywords,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
    server.tool("seo_rank_keywords_remove", "Remove keywords from a rank tracker config by their tracking-keyword IDs. Free — charges no credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        configId: z
            .string()
            .min(1)
            .describe("Rank tracker config ID."),
        keywordIds: z
            .array(z.string().min(1))
            .min(1)
            .describe("Tracking-keyword IDs to remove (returned by seo_rank_keywords_add or seo_rank_check)."),
    }, async ({ projectId, configId, keywordIds }) => {
        const result = await client.delete("/rank-tracking/keywords", {
            projectId,
            configId,
            keywordIds,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=rankKeywords.js.map