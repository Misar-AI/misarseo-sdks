import { z } from "zod";
/**
 * seo_backlinks — backlink profile for a domain or URL.
 * seo_backlink_anchors — anchor-text distribution for the same target.
 */
export function registerBacklinksTool(server, client) {
    server.tool("seo_backlinks", "Get a backlink profile for a domain or URL: total backlinks, referring domains, and top referring domains. Charges credits (~200–500 typical).", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        target: z
            .string()
            .min(1)
            .describe("Domain or URL to analyse (e.g. 'acme.com' or 'https://acme.com/page')."),
        scope: z
            .enum(["domain", "page"])
            .optional()
            .describe("Whether to analyse the whole domain or a single page (default 'domain')."),
        hideSpam: z
            .boolean()
            .optional()
            .describe("Filter out high-spam-score backlinks (default false)."),
    }, async ({ projectId, target, scope, hideSpam }) => {
        const result = await client.get("/backlinks", {
            projectId,
            target,
            scope,
            hideSpam,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
    server.tool("seo_backlink_anchors", "Get the anchor-text distribution for a domain or URL: which anchor texts link to it, and with how many backlinks, referring domains, and dofollow links each. This is what reveals an over-optimised profile (one exact-match commercial phrase dominating) or a hacked one (pharma/casino anchors nobody wrote) — both invisible link by link. Charges credits (~200–500 typical).", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        target: z
            .string()
            .min(1)
            .describe("Domain or URL to analyse (e.g. 'acme.com' or 'https://acme.com/page')."),
        scope: z
            .enum(["domain", "page"])
            .optional()
            .describe("Whether to analyse the whole domain or a single page (default 'domain')."),
        page: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("1-based page number (default 1)."),
        pageSize: z
            .union([z.literal(50), z.literal(100), z.literal(200)])
            .optional()
            .describe("Anchors per page: 50, 100, or 200 (default 100)."),
        sortField: z
            .enum([
            "anchor",
            "backlinks",
            "referringDomains",
            "referringPages",
            "dofollow",
            "firstSeen",
        ])
            .optional()
            .describe("Column to sort by (default 'backlinks')."),
        sortOrder: z
            .enum(["asc", "desc"])
            .optional()
            .describe("Sort direction (default 'desc')."),
    }, async ({ projectId, target, scope, page, pageSize, sortField, sortOrder, }) => {
        const result = await client.get("/backlinks/anchors", {
            projectId,
            target,
            scope,
            page,
            pageSize,
            sortField,
            sortOrder,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=backlinks.js.map