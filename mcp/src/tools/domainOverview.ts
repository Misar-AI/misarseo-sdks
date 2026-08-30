import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_domain_overview — organic footprint for a domain.
 */
export function registerDomainOverviewTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_domain_overview",
    "Get a high-level view of a domain's organic footprint: estimated organic traffic, organic keyword count, backlinks, referring domains, and a domain-authority signal. " +
      "CHARGES CREDITS (~100–300 typical). Requires a plan with full domain overview — the free tier does not have this feature at all and gets an error before the request is made. " +
      "Sections degrade INDEPENDENTLY rather than failing the call: on a deployment running the free data provider the organic traffic/keyword figures and the backlink figures come back null while the authority signal is still populated. A null is 'no source measured this', never 0 — do not report it as a domain having no traffic or no backlinks. The authority figure carries `authoritySource` ('openpagerank' or 'tranco'); attribute it, since a Tranco figure is popularity-derived rather than link-graph authority, and a domain outside Tranco's top 1M honestly returns null.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      domain: z
        .string()
        .min(1)
        .describe(
          "BARE lowercase hostname to analyse (e.g. 'acme.com'). Unlike most domain arguments in this server this one is NOT normalised: a scheme, path, query, '@' or backslash, or any uppercase, is a 400. Strip 'https://' and any trailing path first.",
        ),
      includeSubdomains: z
        .boolean()
        .optional()
        .describe(
          "Count subdomains as part of the domain. Default TRUE — pass false explicitly to measure the bare host only.",
        ),
      locationCode: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "DataForSEO location code. Omit it to use the project's default market, which falls back to 2840 (United States) for a project that has not set one.",
        ),
      languageCode: z
        .string()
        .min(2)
        .max(10)
        .optional()
        .describe("Language code (default 'en')."),
    },
    async ({
      projectId,
      domain,
      includeSubdomains,
      locationCode,
      languageCode,
    }) => {
      const result = await client.get("/domain/overview", {
        projectId,
        domain,
        includeSubdomains,
        locationCode,
        languageCode,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
