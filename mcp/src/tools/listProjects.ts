import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_list_projects — list the caller's MisarSEO projects.
 * This is the entry point: every other tool needs a projectId from here.
 */
export function registerListProjectsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_list_projects",
    "List the MisarSEO projects available to you as `{ projects }`. Call this first to obtain a projectId for the other tools. " +
      "An organization with no project yet gets a default one created on this call, so the list is never empty — a single project you did not create is that default, not evidence of prior work. " +
      "A project's `domain` is what seo_keyword_gap and seo_link_intersect compare against and neither accepts it as an argument, so check it is set before calling those. " +
      "FREE: database only, no SEO data provider is called and no credits are spent.",
    {},
    async () => {
      const result = await client.get("/projects");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
