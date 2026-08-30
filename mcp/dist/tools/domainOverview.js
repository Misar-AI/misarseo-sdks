import { z } from "zod";
/**
 * seo_domain_overview — organic footprint for a domain.
 */
export function registerDomainOverviewTool(server, client) {
    server.tool("seo_domain_overview", "Get a high-level view of a domain's organic footprint: estimated organic traffic, organic keyword count, backlinks, and referring domains. Charges credits (~100–300 typical).", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        domain: z
            .string()
            .min(1)
            .describe("Domain to analyse (e.g. 'acme.com')."),
        includeSubdomains: z
            .boolean()
            .optional()
            .describe("Include subdomains in the analysis (default false)."),
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
    }, async ({ projectId, domain, includeSubdomains, locationCode, languageCode, }) => {
        const result = await client.get("/domain/overview", {
            projectId,
            domain,
            includeSubdomains,
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
//# sourceMappingURL=domainOverview.js.map