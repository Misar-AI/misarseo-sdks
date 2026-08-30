import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

const CLASSIFICATIONS = [
  "missing",
  "behind",
  "tied",
  "ahead",
  "unknown",
] as const;

const SORT_FIELDS = ["volume", "theirPosition", "ourPosition"] as const;

/**
 * seo_keyword_gap — our domain vs. up to 3 competitors, keyword by keyword.
 */
export function registerKeywordGapTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_keyword_gap",
    "Compare the project's own domain against up to 3 competitor domains and classify every keyword a competitor ranks for. " +
      "CHARGES CREDITS: one ranked-keywords lookup per domain, so a single call costs up to 4 upstream requests (the project's domain plus up to 3 competitors). Each lookup is cached 12h, so re-running the same comparison with a different sort or classification filter costs nothing extra — do that instead of issuing a new comparison. " +
      "Reads the top 1,000 keywords per domain by search volume, so a big domain is compared on a slice: `coverage[]` reports `keywordsFetched`, the provider's `keywordsTotal`, `truncated` and `volumeFloor` per domain. " +
      "Five classifications, and two of them must not be conflated: `missing` = a competitor ranks and we provably do not; `unknown` = our own slice ran out above this keyword's volume, so NOTHING was measured about whether we rank. Never report `unknown` as a gap. `behind`/`tied`/`ahead` compare measured positions. " +
      "The project's own domain is read from the project record and cannot be passed here — set the project's domain first if it has none (that returns a validation error). " +
      "When `unavailable` is true, no configured data provider has a ranked-keyword source and no comparison was possible; the empty `rows` in that case does NOT mean the competitors rank for nothing. " +
      "At most 200 rows come back; `totalRows` is how many actually matched.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      competitorDomains: z
        .array(z.string().min(1))
        .min(1)
        .max(3)
        .describe(
          "1–3 competitor domains (bare domain or full URL). Each one is a separate billable lookup, so pick the rivals you actually chase. The project's own domain is added automatically and is dropped from this list if repeated here.",
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
      includeSubdomains: z
        .boolean()
        .optional()
        .describe(
          "Count subdomains as part of a domain (default true). Applies to every compared domain, including ours.",
        ),
      sortField: z
        .enum(SORT_FIELDS)
        .optional()
        .describe(
          "Sort column (default 'volume'). All three are measured values; there is deliberately no composite opportunity score. Nulls sort last in both directions.",
        ),
      sortOrder: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort direction (default 'desc')."),
      classifications: z
        .array(z.enum(CLASSIFICATIONS))
        .min(1)
        .max(CLASSIFICATIONS.length)
        .optional()
        .describe(
          "Restrict rows to these classifications. Omit for all five — omitting never hides `unknown`. Filtering is applied before the 200-row cap, and `totalRows` reports the pre-cap match count.",
        ),
    },
    async ({
      projectId,
      competitorDomains,
      locationCode,
      languageCode,
      includeSubdomains,
      sortField,
      sortOrder,
      classifications,
    }) => {
      const result = await client.post("/keywords/gap", {
        projectId,
        competitorDomains,
        locationCode,
        languageCode,
        includeSubdomains,
        sortField,
        sortOrder,
        classifications,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
