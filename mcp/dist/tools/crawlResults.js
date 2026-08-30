import { z } from "zod";
/**
 * seo_get_crawl_results — get the status and results of a crawl/audit.
 */
export function registerCrawlResultsTool(server, client) {
    server.tool("seo_get_crawl_results", "Get the status and results of a MisarSEO site audit. Poll until status is 'complete' or 'failed'.", {
        projectId: z.string().min(1).describe("MisarSEO project ID."),
        auditId: z
            .string()
            .min(1)
            .describe("Audit ID returned by seo_crawl_site."),
    }, async ({ projectId, auditId }) => {
        const result = await client.get(`/crawl/${auditId}/status`, {
            projectId,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=crawlResults.js.map