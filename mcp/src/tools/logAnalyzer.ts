import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * Log File Analyzer / Bot Analytics tools (GAP-121 / GAP-123).
 *
 * Four tools: list uploads, upload a log, daily bot-hit summary, busiest
 * paths. Uploads require the `admin` role on the API key's user.
 */
export function registerLogAnalyzerTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_log_analyzer_list_uploads",
    "List a project's server-log uploads and their parse status (Log File Analyzer / Bot Analytics). Each row is `{ id, fileName, sizeBytes, status, lineCount, parsedLineCount, skippedLineCount, errorMessage, createdAt, completedAt }`; `status` is queued/parsing/completed/failed. " +
      "FREE: reads MisarSEO state, no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
    },
    async ({ projectId }) => {
      const result = await client.get("/log-analyzer/uploads", { projectId });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_log_analyzer_upload",
    "Upload a server access log for background parsing (Log File Analyzer / Bot Analytics). Only Apache/Nginx Combined Log Format text is supported — pass the raw log text in `content`. " +
      "Parsing runs in the background, so this returns once the upload is stored, before it is fully processed — poll seo_log_analyzer_list_uploads for status. " +
      "Requires the `admin` role. Plan-tier gated: the deployment's tier caps lines processed per upload and uploads per month. " +
      "Tool calls carrying megabytes of text are impractical — prefer the web UI for large logs. FREE: no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      fileName: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .describe("The log file's name, e.g. 'access.log'."),
      content: z
        .string()
        .min(1)
        .describe("Raw Combined Log Format text, one line per request."),
    },
    async ({ projectId, fileName, content }) => {
      const result = await client.post("/log-analyzer/uploads", {
        projectId,
        fileName,
        content,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_log_analyzer_daily_summary",
    "Bot hit counts per (day, bot category, bot label, status code, content-type bucket) across every log upload in the date range — the time-series/status-code/content-type view of Bot Analytics. " +
      "Rows are `{ day, botCategory, botLabel, statusCode, contentType, hitCount }`; botCategory is ai_crawler/search_engine/other_bot. Dates are ISO (YYYY-MM-DD), UTC. " +
      "FREE: reads MisarSEO state, no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      sinceDay: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Inclusive start day, ISO date, UTC."),
      untilDay: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Inclusive end day, ISO date, UTC."),
    },
    async ({ projectId, sinceDay, untilDay }) => {
      const result = await client.get("/log-analyzer/daily-summary", {
        projectId,
        sinceDay,
        untilDay,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_log_analyzer_top_paths",
    "The paths bots hit most, per (bot category, bot label, path, status code) — the busiest-paths table of Bot Analytics. " +
      "Rows are `{ botCategory, botLabel, path, statusCode, hitCount, lastSeenAt }`, ordered by hitCount descending, capped at 200. " +
      "Optionally filter to one bot category (ai_crawler/search_engine/other_bot). FREE: reads MisarSEO state, no credits.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      botCategory: z
        .enum(["ai_crawler", "search_engine", "other_bot"])
        .optional()
        .describe("Filter to one bot category; omit for all."),
    },
    async ({ projectId, botCategory }) => {
      const result = await client.get("/log-analyzer/top-paths", {
        projectId,
        botCategory: botCategory ?? undefined,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}