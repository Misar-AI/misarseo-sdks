import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BatchDraftPatchesInput,
  BatchDraftPatchesResponse,
  DisablePatchAutoPublishResponse,
  DraftPatchInput,
  DraftPatchResponse,
  EnablePatchAutoPublishResponse,
  ListPatchAutoPublishRulesInput,
  ListPatchAutoPublishRulesResponse,
  ListPatchesInput,
  ListPatchesResponse,
  PublishPatchInput,
  PublishPatchResponse,
  RevertPatchInput,
  RevertPatchResponse,
  SetPatchAutoPublishRuleInput,
} from "../types.js";

/**
 * Patches (GAP-025) resource — AI-drafted or hand-edited replacements for a
 * page's title, meta description, canonical URL, or redirect target,
 * reviewed before they can reach the live site. title/metaDescription/
 * canonical are delivered by the embeddable snippet's public manifest;
 * `redirect` is delivered by an operator-deployed Cloudflare Worker instead
 * (see docs/reference/patches-worker-deploy.md) since a redirect needs an
 * HTTP response before the page paints.
 */
export class PatchesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * A project's patches — every draft, published, and reverted row.
   * Free — reads from MisarSEO state, charges no credits.
   */
  list(
    input: ListPatchesInput,
    options?: RequestOptions,
  ): Promise<ListPatchesResponse> {
    return this.http.get<ListPatchesResponse>(
      "/patches",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Draft (or re-draft) a patch. Omit `value` to AI-draft it via
   * assisters.dev (charges the shared AI-gateway budget for `title`/
   * `metaDescription`; `canonical` is always deterministic and never calls
   * the gateway). Requires the `admin` role. 404s if `pageUrl` was not found
   * in the project's most recent completed audit; 400s if the existing patch
   * for this page/field is already published — revert it first.
   */
  draft(
    input: DraftPatchInput,
    options?: RequestOptions,
  ): Promise<DraftPatchResponse> {
    return this.http.post<DraftPatchResponse>("/patches", input, options);
  }

  /**
   * Batch-drafts title AND meta-description patches for up to 10 pages in
   * one call — always AI-drafted via assisters.dev, charged once per field
   * per page (never a bulk discount). A page/field that fails (e.g. not in
   * the latest audit) is reported in that entry's `error` and does not fail
   * the rest of the batch. Requires the `admin` role.
   */
  batchDraft(
    input: BatchDraftPatchesInput,
    options?: RequestOptions,
  ): Promise<BatchDraftPatchesResponse> {
    return this.http.post<BatchDraftPatchesResponse>(
      "/patches/batch-draft",
      input,
      options,
    );
  }

  /**
   * Publish a draft, making it visible in the public manifest the
   * embeddable snippet fetches. Requires the `admin` role.
   */
  publish(
    input: PublishPatchInput,
    options?: RequestOptions,
  ): Promise<PublishPatchResponse> {
    return this.http.post<PublishPatchResponse>(
      `/patches/${input.patchId}/publish`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Revert a published patch — removes it from the manifest immediately.
   * Nothing is written back to the audited site. Requires the `admin` role.
   */
  revert(
    input: RevertPatchInput,
    options?: RequestOptions,
  ): Promise<RevertPatchResponse> {
    return this.http.post<RevertPatchResponse>(
      `/patches/${input.patchId}/revert`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * A project's per-issue-type auto-publish opt-ins.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listAutoPublishRules(
    input: ListPatchAutoPublishRulesInput,
    options?: RequestOptions,
  ): Promise<ListPatchAutoPublishRulesResponse> {
    return this.http.get<ListPatchAutoPublishRulesResponse>(
      "/patches/auto-publish-rules",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Opt an issue type into auto-publish: a freshly AI-drafted patch of that
   * type publishes immediately, capped per project per day. A manually
   * supplied `draft()` value is never auto-published. Requires the `admin`
   * role.
   */
  enableAutoPublish(
    input: SetPatchAutoPublishRuleInput,
    options?: RequestOptions,
  ): Promise<EnablePatchAutoPublishResponse> {
    return this.http.post<EnablePatchAutoPublishResponse>(
      "/patches/auto-publish-rules",
      input,
      options,
    );
  }

  /** Turn auto-publish back off for an issue type. Requires the `admin` role. */
  disableAutoPublish(
    input: SetPatchAutoPublishRuleInput,
    options?: RequestOptions,
  ): Promise<DisablePatchAutoPublishResponse> {
    return this.http.delete<DisablePatchAutoPublishResponse>(
      "/patches/auto-publish-rules",
      input,
      options,
    );
  }
}
