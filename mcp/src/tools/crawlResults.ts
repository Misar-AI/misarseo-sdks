import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_get_crawl_results — get the PROGRESS of a crawl/audit.
 *
 * Named "results" for backwards compatibility with published clients, but
 * `GET /crawl/{auditId}/status` returns `AuditService.getStatus` — a progress
 * summary. The page-level findings live behind the web app's server functions
 * and are not on the REST surface at all, so the description must not promise
 * them.
 */
export function registerCrawlResultsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_get_crawl_results",
    "Get the PROGRESS of a MisarSEO site audit: `{ status, pagesCrawled, pagesTotal, lighthouseTotal, lighthouseCompleted, lighthouseFailed, currentPhase, startedAt, completedAt }`. " +
      "`status` is one of 'running', 'completed' or 'failed' — poll until it is 'completed' or 'failed'. There is no 'complete' status; waiting for that string never terminates. " +
      "It does NOT return the crawled pages or the individual audit issues — no REST endpoint exposes those. Once status is 'completed', use seo_audit_comparison for what changed against the previous audit. " +
      "FREE — charges no credits.",
    {
      projectId: z.string().min(1).describe("MisarSEO project ID."),
      auditId: z
        .string()
        .min(1)
        .describe(
          "Audit ID returned by seo_crawl_site (its `auditId`/`jobId` — they are the same value).",
        ),
    },
    async ({ projectId, auditId }) => {
      const result = await client.get(`/crawl/${auditId}/status`, {
        projectId,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
