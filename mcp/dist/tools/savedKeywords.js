import { z } from "zod";
/**
 * seo_saved_keywords_list — list keywords saved to a project.
 * seo_saved_keywords_save — save keywords to a project's keyword list.
 */
export function registerSavedKeywordsTool(server, client) {
    server.tool("seo_saved_keywords_list", "List keywords saved to a MisarSEO project, with cached metrics (volume, difficulty, CPC). Free — charges no credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        search: z
            .string()
            .optional()
            .describe("Filter by keyword text (case-insensitive substring match)."),
        tags: z
            .array(z.string().min(1))
            .optional()
            .describe("Filter by tag names (must match all provided tags)."),
        limit: z
            .union([z.literal(50), z.literal(100), z.literal(250)])
            .optional()
            .describe("Max rows to return: 50, 100, or 250 (default 50)."),
    }, async ({ projectId, search, tags, limit }) => {
        const result = await client.get("/keywords/saved", {
            projectId,
            search,
            tags: tags?.join(","),
            limit,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
    server.tool("seo_saved_keywords_save", "Save keywords to a MisarSEO project's keyword list. Idempotent — duplicates are skipped. Free — charges no credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        keywords: z
            .array(z.string().min(1))
            .min(1)
            .max(500)
            .describe("Keywords to save (1–500)."),
        tags: z
            .array(z.string().min(1))
            .optional()
            .describe("Tags to attach to all saved keywords."),
        tagMode: z
            .enum(["append", "replace"])
            .optional()
            .describe("How to apply tags to keywords that already exist: 'append' (default) or 'replace'."),
    }, async ({ projectId, keywords, tags, tagMode }) => {
        const result = await client.post("/keywords/saved", {
            projectId,
            keywords,
            tags,
            tagMode,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=savedKeywords.js.map