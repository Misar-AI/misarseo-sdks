/**
 * MisarSEO TypeScript SDK — patches (GAP-025) types.
 *
 * A patch is a draft replacement for one page's title, meta description, or
 * canonical URL, reviewed by a human before it can reach the live site.
 * Publishing a patch never writes to the audited site itself — it only makes
 * the row visible in the public manifest the embeddable snippet fetches (see
 * `docs/reference/misarseo-gap-register.md`'s GAP-025 row); reverting is
 * therefore instant.
 */

export type PatchField = "title" | "metaDescription" | "canonical";
export type PatchStatus = "draft" | "published" | "reverted";

/**
 * The `AuditIssueType`s a patch can address. A string union rather than
 * `AuditIssueType` itself — that type's other ~60 members would type-check a
 * value this route always rejects with a 400.
 */
export type PatchableIssueType =
  | "missing_title"
  | "title_too_long"
  | "title_too_short"
  | "missing_meta_description"
  | "meta_description_too_long"
  | "missing_canonical";

export interface Patch {
  id: string;
  projectId: string;
  pageUrl: string;
  field: PatchField;
  issueType: string;
  status: PatchStatus;
  /** The page's own value when this patch was (re-)drafted, or null if it had none. */
  currentValue: string | null;
  draftValue: string;
  autoPublished: boolean;
  createdByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPatchesInput {
  projectId: string;
}

export interface ListPatchesResponse {
  patches: Patch[];
}

export interface DraftPatchInput {
  projectId: string;
  pageUrl: string;
  issueType: PatchableIssueType;
  /** A human-supplied replacement. Omit (or null) to AI-draft it. */
  value?: string | null;
}

export type DraftPatchResponse = Patch;

export interface PublishPatchInput {
  projectId: string;
  patchId: string;
}

export type PublishPatchResponse = Patch;

export interface RevertPatchInput {
  projectId: string;
  patchId: string;
}

export type RevertPatchResponse = Patch;

export interface PatchAutoPublishRule {
  id: string;
  projectId: string;
  issueType: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ListPatchAutoPublishRulesInput {
  projectId: string;
}

export interface ListPatchAutoPublishRulesResponse {
  rules: PatchAutoPublishRule[];
}

export interface SetPatchAutoPublishRuleInput {
  projectId: string;
  issueType: PatchableIssueType;
}

/**
 * `{ alreadyExists: true }` when the unique (project, issueType) index
 * absorbed a duplicate — the 200 rather than 201 case.
 */
export type EnablePatchAutoPublishResponse =
  | PatchAutoPublishRule
  | { alreadyExists: true };

export interface DisablePatchAutoPublishResponse {
  deleted: true;
}
