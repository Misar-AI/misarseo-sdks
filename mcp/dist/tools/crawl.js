import { z } from "zod";
/**
 * seo_crawl_site — start a site crawl/audit.
 */
export function registerCrawlTool(server, client) {
    server.tool("seo_crawl_site", "Start a MisarSEO site crawl/audit. Returns an auditId you can poll with seo_get_crawl_results.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        url: z
            .string()
            .url()
            .describe("Root URL to crawl (e.g. 'https://example.com')."),
        maxPages: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Maximum pages to crawl. Defaults to the project plan limit."),
    }, async ({ projectId, url, maxPages }) => {
        const result = await client.post("/crawl/start", {
            projectId,
            url,
            maxPages,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=crawl.js.map