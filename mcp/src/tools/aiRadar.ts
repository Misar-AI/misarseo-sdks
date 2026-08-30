import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_ai_radar — look up brand visibility in AI-generated answers.
 */
export function registerAiRadarTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_ai_radar",
    "Look up how a brand or domain is mentioned across AI platforms (ChatGPT and Google AI Overviews — those two, not every assistant). Returns share of voice, top cited pages, and top prompts. " +
      "CHARGES CREDITS and consumes one of the organization's monthly brand-radar scans. Requires a paid plan: the free tier's scan allowance is zero, so a free-plan organization gets an error rather than a result. The quota is spent when the scan is ACCEPTED, before any answer exists — so ask before re-running one. " +
      "It runs on a background queue and this tool polls for it, returning the shaped result once it completes. Polling stops after 120s with a timeout message — the scan is still running and is not lost, but there is no status-only tool here, so the only way to collect the result is to call this tool again, which consumes ANOTHER monthly scan from the quota. Report the timeout and ask before doing that. " +
      "Mentions and AI search volumes are nullable and a null is 'not reported by the platform', never 0. " +
      "Each completed scan also records a point on the trend that seo_brand_scan_trend reads.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      brand: z
        .string()
        .min(1)
        .max(250)
        .describe(
          "Brand name or domain to look up (e.g. 'Acme Corp' or 'acme.com').",
        ),
      competitors: z
        .array(z.string().min(1).max(250))
        .max(5)
        .optional()
        .describe(
          "Up to 5 competitor brands or domains to compare share of voice against.",
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
        .max(8)
        .optional()
        .describe("Language code (default 'en')."),
    },
    async ({ projectId, brand, competitors, locationCode, languageCode }) => {
      // AI radar runs asynchronously on the misarseo:ai-radar queue: enqueue,
      // then poll the status route until the shaped result is ready.
      const { jobId } = await client.post<{ jobId: string }>(
        "/ai/brand-lookup",
        {
          projectId,
          query: brand,
          competitors: competitors ?? [],
          locationCode,
          languageCode,
        },
      );

      const POLL_INTERVAL_MS = 2000;
      const TIMEOUT_MS = 120000;
      const deadline = Date.now() + TIMEOUT_MS;

      for (;;) {
        const res = await client.get<{
          status: string;
          result?: unknown;
          error?: { message?: string };
        }>(`/ai/brand-lookup/${encodeURIComponent(jobId)}/status`, {
          projectId,
        });

        if (res.status === "complete") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(res.result, null, 2),
              },
            ],
          };
        }
        if (res.status === "errored") {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `AI radar scan failed: ${res.error?.message ?? "unknown error"}`,
              },
            ],
          };
        }
        if (Date.now() >= deadline) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                // No status-only tool exists here, so "retry status" was advice
                // an agent could not act on. Say what is actually true: the
                // scan is still running, and re-calling this tool is a second
                // submission that spends another monthly scan.
                text: `AI radar scan timed out after ${TIMEOUT_MS}ms while still running (jobId ${jobId}). Nothing was lost and the provider result is cached, but this server has no status-only tool: collecting it means calling seo_ai_radar again with the same arguments, which consumes another monthly brand-radar scan. Report the timeout and ask before re-running.`,
              },
            ],
          };
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    },
  );
}
