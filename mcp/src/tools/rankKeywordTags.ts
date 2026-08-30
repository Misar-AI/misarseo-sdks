import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MisarSeoApiError, type MisarSeoClient } from "../client.js";

const MAX_TAG_KEYWORDS_PER_CALL = 500;

/**
 * Turn the two flat selector arguments into the API's `{ tagId } | { tagName }`
 * union.
 *
 * Flat arguments because an agent fills scalars far more reliably than a nested
 * anyOf; the union is rebuilt here so the request body still carries exactly one
 * selector and the server never has to guess which one was meant.
 */
function resolveTagSelector(input: {
  tagId: string | undefined;
  tagName: string | undefined;
}): { tagId: string } | { tagName: string } {
  if (input.tagId && input.tagName) {
    throw new MisarSeoApiError(
      "Pass either tagId or tagName, not both — they select the same tag two different ways.",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (input.tagId) return { tagId: input.tagId };
  if (input.tagName) return { tagName: input.tagName };
  throw new MisarSeoApiError(
    "Pass one of tagId or tagName to name the tag to add or remove.",
    400,
    "VALIDATION_ERROR",
  );
}

/**
 * seo_rank_keyword_tags_list   — tags in use on a tracker + the project vocabulary.
 * seo_rank_keyword_tags_update — attach/detach ONE tag across tracked keywords.
 */
export function registerRankKeywordTagsTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_rank_keyword_tags_list",
    "List the tags in use on one rank tracker, plus the project's whole tag vocabulary. Use it to discover tag IDs before calling seo_rank_keyword_tags_update, and to see how a large tracker is already organised. " +
      "FREE: database only. No SEO data provider is called and no credits are spent, so it is safe to call as often as needed. " +
      "Returns two separate lists and they mean different things. `tagsInUse` is what THIS tracker's keywords actually carry, and its `keywordCount` counts TRACKED keywords carrying the tag — not the saved-keyword count the same tag carries elsewhere, which would never match the rows it filters. It is empty for a tracker that has never used a tag. `projectTags` is the project's full vocabulary, including tags this tracker has not used yet; assign from it rather than inventing a new name. " +
      "The vocabulary is the project's EXISTING saved-keyword tags — one tag namespace shared with the saved-keyword list, not a second set.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      configId: z
        .string()
        .min(1)
        .describe(
          "Rank tracker config ID. Take it from seo_rank_tracker_create's `configId` or from the rank tracking screen in the app — no tool in this server lists a project's trackers, and seo_rank_check requires a configId rather than listing them.",
        ),
    },
    async ({ projectId, configId }) => {
      const result = await client.get("/rank-tracking/keyword-tags", {
        projectId,
        configId,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "seo_rank_keyword_tags_update",
    `Attach or detach ONE tag across a selection of tracked keywords (up to ${MAX_TAG_KEYWORDS_PER_CALL} keyword IDs per call). One tag per call — to apply three tags, make three calls. ` +
      "FREE: database only. No SEO data provider is called and no credits are spent. " +
      "The tag is the project's EXISTING saved-keyword tag vocabulary, shared with the saved-keyword list. Pass `tagId` for a tag that already exists (list them with seo_rank_keyword_tags_list), or `tagName` to match on the normalised name — 'Branded', 'branded' and ' branded ' are the same tag. On `action: \"add\"` an unknown `tagName` CREATES the tag for the whole project, so check the vocabulary first rather than coining near-duplicates. On `action: \"remove\"` an unknown tag is a 404: there is nothing to detach. " +
      'DO NOT REPORT `changed` AS A COUNT OF NEW LINKS ON AN ADD. `action: "add"` always returns `changed: null` because the insert is idempotent and how many links were actually new is not knowable without a second read — `null` means "not measured", it is not zero, and it is NOT the number of keyword IDs submitted. `action: "remove"` returns a real `changed` count. Report `keywordCount` (the tracked keywords the action was applied to, after de-duplication) when asked how many keywords were touched. ' +
      "Both actions return `keywordCount: 0` and `changed: 0` when none of the submitted IDs belong to this tracker — that is a no-op, not a success worth reporting as a tagging. " +
      "IDs are tracking-keyword IDs from the rank tracker, not saved-keyword IDs and not keyword strings.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      configId: z
        .string()
        .min(1)
        .describe(
          "Rank tracker config ID the keywords belong to. Call seo_rank_check with that configId for the tracker's keyword rows; each row's `id` is a tracking-keyword ID.",
        ),
      action: z
        .enum(["add", "remove"])
        .describe(
          "'add' attaches the tag (creating it from `tagName` if new); 'remove' detaches it.",
        ),
      tagId: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Existing tag ID from seo_rank_keyword_tags_list. Pass this OR `tagName`, never both.",
        ),
      tagName: z
        .string()
        .min(1)
        .max(64)
        .optional()
        .describe(
          "Tag name, matched on its normalised form. Created on 'add' when it does not exist; a 404 on 'remove'. Pass this OR `tagId`, never both.",
        ),
      trackingKeywordIds: z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_TAG_KEYWORDS_PER_CALL)
        .describe(
          `Tracking-keyword IDs to tag or untag (1–${MAX_TAG_KEYWORDS_PER_CALL}). These come from the rank tracker's keyword rows — not saved-keyword IDs, and not keyword text. Duplicates are collapsed server-side, and IDs from another tracker are ignored rather than errored.`,
        ),
    },
    async ({
      projectId,
      configId,
      action,
      tagId,
      tagName,
      trackingKeywordIds,
    }) => {
      const result = await client.post("/rank-tracking/keyword-tags", {
        projectId,
        configId,
        action,
        tag: resolveTagSelector({ tagId, tagName }),
        trackingKeywordIds,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
