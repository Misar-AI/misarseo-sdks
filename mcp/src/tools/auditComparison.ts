import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_audit_comparison — what changed between two site audits.
 */
export function registerAuditComparisonTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_audit_comparison",
    "Compare a site audit against an earlier one: which issues are new, which were fixed, how many persist, and the health-score delta. Only pages BOTH crawls visited are compared, so a shorter crawl never reports the pages it missed as fixed — those are reported separately as notComparableCount. Returns an error when there is no earlier completed audit to compare against. Free — charges no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      auditId: z
        .string()
        .min(1)
        .describe(
          "Audit ID to compare, from seo_crawl_site or seo_get_crawl_results.",
        ),
      baselineAuditId: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Audit ID to compare against. OMIT IT unless you have a reason: omitting picks the COMPLETED run immediately before auditId, while a baseline named here is used as given with no completed-status check — pointing it at a failed or still-running crawl diffs against a partial page set. Comparing an audit to itself is a validation error.",
        ),
    },
    async ({ projectId, auditId, baselineAuditId }) => {
      const result = await client.get(`/crawl/${auditId}/comparison`, {
        projectId,
        baselineAuditId,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
