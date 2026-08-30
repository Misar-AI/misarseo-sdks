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
  PromptExplorerInput,
  PromptExplorerResponse,
} from "../types.js";

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
   * Run a prompt against up to 4 LLMs (ChatGPT, Claude, Gemini, Perplexity)
   * and see whether the brand is mentioned in the answers.
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
}
