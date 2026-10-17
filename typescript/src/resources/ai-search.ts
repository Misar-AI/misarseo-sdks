import type { HttpClient, RequestOptions } from "../http.js";
import { MisarSeoAbortError } from "../error.js";
import { sleep } from "../retry.js";
import type {
  BrandLookupInput,
  BrandLookupJob,
  BrandLookupStatusInput,
  BrandLookupStatusResponse,
  BrandScanResult,
  BrandScanTrendInput,
  BrandScanTrendResponse,
  CompetitorPositioningInput,
  CompetitorPositioningResponse,
  DeleteBrandMonitorInput,
  DeleteTrackedPromptInput,
  ListBrandMonitorsInput,
  ListBrandMonitorsResponse,
  ListTrackedPromptsInput,
  ListTrackedPromptsResponse,
  MutationSuccess,
  PromptExplorerInput,
  PromptExplorerResponse,
  PromptResearchInput,
  PromptResearchResult,
  TrackedPromptTrendInput,
  TrackedPromptTrendResponse,
  UpsertBrandMonitorInput,
  UpsertBrandMonitorResponse,
  UpsertTrackedPromptInput,
  UpsertTrackedPromptResponse,
} from "../types.js";
import type { CitationsInput, CitationsResponse } from "../types-team.js";

/**
 * AI Search resource — brand visibility in AI-generated answers.
 */
export class AiSearchResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Enqueue a brand-lookup scan (how a brand/domain is mentioned across
   * ChatGPT and Google AI Overviews). The scan runs asynchronously on the
   * `misarseo:ai-radar` queue; poll {@link brandLookupStatus} with the returned
   * `jobId`, or use {@link brandLookupAndWait} to await the shaped result.
   */
  brandLookup(
    input: BrandLookupInput,
    options?: RequestOptions,
  ): Promise<BrandLookupJob> {
    return this.http.post<BrandLookupJob>("/ai/brand-lookup", input, options);
  }

  /**
   * Poll the status of an enqueued brand-lookup job. The shaped
   * `BrandScanResult` is included on the response only once `status` is
   * `"complete"`.
   */
  brandLookupStatus(
    input: BrandLookupStatusInput,
    options?: RequestOptions,
  ): Promise<BrandLookupStatusResponse> {
    return this.http.get<BrandLookupStatusResponse>(
      `/ai/brand-lookup/${encodeURIComponent(input.jobId)}/status`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Convenience: enqueue a brand-lookup and poll until it completes (or errors
   * / times out), resolving with the shaped result.
   *
   * @param opts.intervalMs - poll interval (default 2000ms)
   * @param opts.timeoutMs  - give up after this long (default 120000ms). This
   *   is the deadline for the whole scan; `options.timeoutMs`, if given, is the
   *   much shorter deadline for each individual HTTP request.
   * @param options - per-request options; `options.signal` also cuts short the
   *   wait between polls, so cancelling doesn't idle for a full interval first.
   */
  async brandLookupAndWait(
    input: BrandLookupInput,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
    options?: RequestOptions,
  ): Promise<BrandScanResult> {
    const intervalMs = opts.intervalMs ?? 2000;
    const timeoutMs = opts.timeoutMs ?? 120000;
    const { jobId } = await this.brandLookup(input, options);
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const res = await this.brandLookupStatus(
        { jobId, projectId: input.projectId },
        options,
      );
      if (res.status === "complete" && res.result) return res.result;
      if (res.status === "errored") {
        throw new Error(res.error?.message ?? "Brand lookup failed");
      }
      if (Date.now() >= deadline) {
        throw new Error(`Brand lookup timed out after ${timeoutMs}ms`);
      }
      await sleep(intervalMs, options?.signal);
      if (options?.signal?.aborted) throw new MisarSeoAbortError();
    }
  }

  /**
   * Run a prompt against up to 4 LLMs (labelled ChatGPT, Claude, Gemini,
   * Perplexity) and see whether the brand is mentioned in the answers. The
   * labels are personas, not a vendor guarantee: each routes to its own real,
   * distinct model, but the gateway has no real Claude or Perplexity backend
   * to route to at all, so those two never match their real vendor.
   *
   * `input.analyzeSentiment` (GAP-142, requires `highlightBrand`) spends one
   * extra credit classifying each successful answer's sentiment toward that
   * brand from the answer TEXT ALREADY RETURNED — real analysis of a real
   * answer, never a second model call pretending to be a persona.
   *
   * Resolves to `{ result }`, not the run itself — the route wraps it and
   * always has. This was declared as the inner object, so `response.results`
   * was `undefined` on every call and the four answers just paid for were one
   * level down. Destructure it:
   *
   * ```typescript
   * const { result } = await client.aiSearch.promptExplorer({ ... });
   * ```
   */
  promptExplorer(
    input: PromptExplorerInput,
    options?: RequestOptions,
  ): Promise<PromptExplorerResponse> {
    return this.http.post<PromptExplorerResponse>(
      "/ai/prompt-explorer",
      input,
      options,
    );
  }

  /**
   * Observed AI-visibility history for one target — one point per recorded
   * scan, oldest first.
   *
   * The series is empty for a newly tracked target and fills in as scans run:
   * it reports only what past scans measured, with no interpolation and no
   * back-filled months.
   * Free — reads recorded scans, charges no credits.
   */
  brandScanTrend(
    input: BrandScanTrendInput,
    options?: RequestOptions,
  ): Promise<BrandScanTrendResponse> {
    return this.http.get<BrandScanTrendResponse>(
      "/ai/brand-scan-trend",
      {
        projectId: input.projectId,
        target: input.target,
        since: input.since,
      },
      options,
    );
  }

  /** A project's brand monitors — targets scanned proactively on a schedule,
   *  rather than only on an ad hoc {@link brandLookup} call. */
  listBrandMonitors(
    input: ListBrandMonitorsInput,
    options?: RequestOptions,
  ): Promise<ListBrandMonitorsResponse> {
    return this.http.get<ListBrandMonitorsResponse>(
      "/ai/brand-monitors",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Creates or replaces a brand monitor. Requires the admin role in the
   * calling organization — see {@link UpsertBrandMonitorInput}'s own docs.
   */
  upsertBrandMonitor(
    input: UpsertBrandMonitorInput,
    options?: RequestOptions,
  ): Promise<UpsertBrandMonitorResponse> {
    return this.http.post<UpsertBrandMonitorResponse>(
      "/ai/brand-monitors",
      input,
      options,
    );
  }

  /** Requires the admin role in the calling organization, same as creating one. */
  deleteBrandMonitor(
    input: DeleteBrandMonitorInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    // `projectId` travels in the QUERY, which is where the route reads it;
    // sent as a DELETE body it was ignored and every call answered 400.
    return this.http.delete<MutationSuccess>(
      `/ai/brand-monitors/${encodeURIComponent(input.monitorId)}?projectId=${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }

  /**
   * GAP-144 — a project's tracked prompts: re-checked through Prompt
   * Explorer's REAL answer pipeline on a schedule, diffed against the
   * immediately-prior check for mention/citation drops. Mirrors
   * {@link listBrandMonitors}.
   */
  listTrackedPrompts(
    input: ListTrackedPromptsInput,
    options?: RequestOptions,
  ): Promise<ListTrackedPromptsResponse> {
    return this.http.get<ListTrackedPromptsResponse>(
      "/ai/prompt-tracking",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Creates or replaces a tracked prompt. Requires the admin role in the
   * calling organization — starts unattended recurring AI-search-credit
   * spend, same gate {@link upsertBrandMonitor} uses.
   */
  upsertTrackedPrompt(
    input: UpsertTrackedPromptInput,
    options?: RequestOptions,
  ): Promise<UpsertTrackedPromptResponse> {
    return this.http.post<UpsertTrackedPromptResponse>(
      "/ai/prompt-tracking",
      input,
      options,
    );
  }

  /** Requires the admin role in the calling organization, same as creating one. */
  deleteTrackedPrompt(
    input: DeleteTrackedPromptInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    // `projectId` travels in the QUERY, which is where the route reads it;
    // sent as a DELETE body it was ignored and every call answered 400.
    return this.http.delete<MutationSuccess>(
      `/ai/prompt-tracking/${encodeURIComponent(input.trackedPromptId)}?projectId=${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }

  /**
   * Observed history for one tracked prompt — one point per real scheduled
   * check, oldest first. Empty until checks accumulate, same measured-not-
   * modelled shape {@link brandScanTrend} uses. Free — reads recorded
   * checks, charges no credits.
   */
  trackedPromptTrend(
    input: TrackedPromptTrendInput,
    options?: RequestOptions,
  ): Promise<TrackedPromptTrendResponse> {
    return this.http.get<TrackedPromptTrendResponse>(
      `/ai/prompt-tracking/${encodeURIComponent(input.trackedPromptId)}/trend`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * GAP-145 — run one prompt through Prompt Explorer and check `input.brand`
   * plus `input.competitors` against the SAME real per-model answers for
   * mentions/citations. NOT a rebuild of Brand Lookup's mentions
   * aggregation (permanently null/empty — see that method's own docs) and
   * NOT a comprehensive cross-prompt visibility score: this is what ONE
   * prompt's real, observed answers show for the named entities.
   *
   * Costs the same as one {@link promptExplorer} call for the requested
   * models — comparing more competitors against that one set of answers is
   * pure string matching, not extra completions.
   */
  competitorPositioning(
    input: CompetitorPositioningInput,
    options?: RequestOptions,
  ): Promise<CompetitorPositioningResponse> {
    return this.http.post<CompetitorPositioningResponse>(
      "/ai/competitor-positioning",
      input,
      options,
    );
  }

  /**
   * GAP-143 — candidate AI prompts for a seed topic (real PAA-style
   * questions, intent-classified, flagged if already tracked) plus this
   * project's already-tracked prompts (GAP-144) ranked by their most
   * recently OBSERVED mention rate.
   *
   * NOT "prompt volume": there is no real search-volume-style corpus for
   * arbitrary natural-language prompts, and this never fabricates one — see
   * `PromptResearchResult`'s own docs for the two honest signals this
   * composes instead. FREE — no AI-gateway budget, no paid-plan gate, unlike
   * every other method on this resource.
   */
  promptResearch(
    input: PromptResearchInput,
    options?: RequestOptions,
  ): Promise<PromptResearchResult> {
    return this.http.post<PromptResearchResult>(
      "/ai/prompt-research",
      input,
      options,
    );
  }

  /**
   * Which of up to 10 queries' answers cite `domain`. Answers a bare object
   * `{ domain, submitted, checked, citations, summary }`; `checked` is the
   * denominator `summary.cited` is drawn from.
   */
  citations(
    input: CitationsInput,
    options?: RequestOptions,
  ): Promise<CitationsResponse> {
    return this.http.post<CitationsResponse>("/citations", input, options);
  }
}
