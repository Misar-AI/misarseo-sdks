import { z } from "zod";
/**
 * seo_rank_check — get rank tracker configs and latest keyword position snapshots.
 */
export function registerRankCheckTool(server, client) {
    server.tool("seo_rank_check", "Get rank tracker configs and the latest keyword position snapshots for a MisarSEO project. Free — charges no credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        configId: z
            .string()
            .optional()
            .describe("Rank tracker config ID. If omitted, lists all rank trackers in the project."),
    }, async ({ projectId, configId }) => {
        const result = await client.get("/rank-tracking/keywords", {
            projectId,
            configId,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=rankCheck.js.map