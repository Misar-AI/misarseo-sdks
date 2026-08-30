import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_backlinks — backlink profile for a domain or URL.
 * seo_backlink_anchors — anchor-text distribution for the same target.
 */
export function registerBacklinksTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_backlinks",
    "Get a backlink profile for a domain or URL: total backlinks, referring domains, and top referring domains. " +
      "CHARGES CREDITS (~200–500 typical). " +
      "UNAVAILABLE ON THE FREE DATA PROVIDER: a backlink graph needs a proprietary web-scale crawl index, so a deployment running the free provider answers 501 SEO_DATA_UNAVAILABLE. That is an absence of a source, never 'this site has no backlinks'.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      // No length cap: unlike /backlinks/anchors, this route reads `target`
      // straight off the query string with no schema, so declaring a 2048-char
      // ceiling here would advertise a limit the route does not have.
      target: z
        .string()
        .min(1)
        .describe(
          "Domain or URL to analyse (e.g. 'acme.com' or 'https://acme.com/page').",
        ),
      scope: z
        .enum(["domain", "page"])
        .optional()
        .describe(
          "Whether to analyse the whole domain or a single page. Default 'domain' — and anything other than the exact string 'page' is read as 'domain' rather than rejected.",
        ),
    },
    async ({ projectId, target, scope }) => {
      const result = await client.get("/backlinks", {
        projectId,
        target,
        scope,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_backlink_anchors",
    "Get the anchor-text distribution for a domain or URL: which anchor texts link to it, and with how many backlinks, referring domains, and dofollow links each. This is what reveals an over-optimised profile (one exact-match commercial phrase dominating) or a hacked one (pharma/casino anchors nobody wrote) — both invisible link by link. " +
      "CHARGES CREDITS (~200–500 typical). " +
      "UNAVAILABLE ON THE FREE DATA PROVIDER, for the same reason as the rest of the backlinks surface: it is an aggregate over a proprietary backlink index, so a free-provider deployment answers 501 SEO_DATA_UNAVAILABLE rather than an empty distribution. " +
      "There is deliberately no spam-score column — the provider aggregates anchors over links, and an averaged spam score is not a spam score.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      target: z
        .string()
        .min(1)
        .max(2048)
        .describe(
          "Domain or URL to analyse (e.g. 'acme.com' or 'https://acme.com/page').",
        ),
      scope: z
        .enum(["domain", "page"])
        .optional()
        .describe(
          "Whether to analyse the whole domain or a single page (default 'domain').",
        ),
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
    },
    async ({
      projectId,
      target,
      scope,
      page,
      pageSize,
      sortField,
      sortOrder,
    }) => {
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
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
