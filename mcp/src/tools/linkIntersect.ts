import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

const SORT_FIELDS = ["competitors", "authority", "linkingPages"] as const;

/**
 * seo_link_intersect — domains linking to our competitors but not to us.
 */
export function registerLinkIntersectTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_link_intersect",
    "Find the domains that link to 2–4 of the project's competitors but NOT to the project itself — every row is a site that has already demonstrated it will link to something in this space, which makes it the most actionable backlink report there is. " +
      "CHARGES CREDITS, and this is the most expensive call in the backlinks surface: one referring-domains lookup per request, FIVE of them paging the project's own referring domains plus ONE per competitor, so a single run costs up to NINE upstream requests (1,000 domains each). Every request is cached per organization+target+page, so re-running the same intersect with a different `minCompetitors`, `includeUnproven` or sort is FREE — do that instead of issuing a new run. Ask the user before running it repeatedly across many competitor sets. " +
      "UNAVAILABLE ON THE FREE DATA PROVIDER: backlink graphs need a proprietary web-scale crawl index, so a deployment running the free provider returns `unavailable: true` with a reason and NO rows. That is not a 501 and not an empty result — `totalRows`, `provenRows` and `unprovenRows` are 0 on that response and are NOT measurements. Read `unavailable` before `rows`, and never report an unavailable run as 'no linking opportunities exist'. " +
      'Two absence states, and they must NOT be conflated: `absence: "proven"` means our own referring-domain read ruled the domain out, so \'does not link to us\' is a measurement; `absence: "unproven"` means our read was cut off at or above that domain\'s authority, so it may already link to us and nothing was established. `provenRows` is the headline count and excludes unproven rows by construction. Never present an `unproven` row as a confirmed opportunity. ' +
      "`absenceBound` says which regime applies: `complete` (our whole profile was read) or `authority-floor` with the `authorityFloor` strictly above which absence is evidence. `coverage[]` is the per-target ledger — `domainsRead`, the provider's `domainsTotal`, `requestsSpent`/`requestBudget`, `truncated`, `authorityFloor`, and a per-target `unavailable`/`unavailableReason`. A competitor cell's `found: false` only means 'does not link to them' when that competitor's coverage is not `truncated`. " +
      "The project's own domain is read from the project record and cannot be passed here — if the project has no domain the call fails with a validation error telling the user to set one. " +
      "`minCompetitors` is clamped to the number of competitor domains that actually resolved (duplicates and the project's own domain are dropped); compare `minCompetitors` against `minCompetitorsRequested` before saying a run found nothing. " +
      "At most 200 rows come back; `totalRows` is the real match count. There is deliberately no composite opportunity score — every sortable column is a value the provider measured.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      competitorDomains: z
        .array(z.string().min(1))
        .min(2)
        .max(4)
        .describe(
          "2–4 competitor domains (bare domain or full URL). Each one is a separate billable referring-domains lookup, so pick the rivals actually being chased. Two is the minimum because with a single competitor this degenerates into a one-sided referring-domain diff, not an intersect. The project's own domain is added automatically and is dropped from this list if repeated here.",
        ),
      minCompetitors: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe(
          "Keep only domains linking to at least this many of the compared competitors (default 2). Clamped server-side to the number of competitors that resolved; read `minCompetitors` on the result for what was applied and `minCompetitorsRequested` for what was asked.",
        ),
      includeUnproven: z
        .boolean()
        .optional()
        .describe(
          "Include rows whose absence from our profile could not be proven (default true). Leave it true: setting it false silently drops real candidates, and unproven rows are labelled rather than hidden.",
        ),
      sortField: z
        .enum(SORT_FIELDS)
        .optional()
        .describe(
          "Sort column (default 'competitors'). All three are measured values: 'competitors' counts how many rivals' read slices contain the domain, 'authority' is the linking domain's own provider rank, 'linkingPages' is the most pages it points at any one rival. Re-sorting a run costs nothing.",
        ),
      sortOrder: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort direction (default 'desc')."),
    },
    async ({
      projectId,
      competitorDomains,
      minCompetitors,
      includeUnproven,
      sortField,
      sortOrder,
    }) => {
      const result = await client.post("/backlinks/intersect", {
        projectId,
        competitorDomains,
        minCompetitors,
        includeUnproven,
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
