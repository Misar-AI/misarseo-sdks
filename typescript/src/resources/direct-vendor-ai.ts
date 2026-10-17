import type { HttpClient, RequestOptions } from "../http.js";
import type {
  DirectVendorAnswersInput,
  DirectVendorAnswersResponse,
} from "../types.js";

/**
 * Direct Vendor Answers (GAP-206) — a NEW resource, deliberately kept
 * separate from {@link AiSearchResource}'s `promptExplorer`, even though both
 * ask a prompt and check it for a brand mention.
 *
 * `promptExplorer` asks four PERSONAS ("ChatGPT-style"/"Claude-style"/
 * "Gemini-style"/"Perplexity-style") routed through assisters.dev, a gateway
 * that has no real Claude or Perplexity provider at all and forbids ever
 * disclosing which real vendor answered a call. This resource is the
 * opposite: every model here is that vendor's OWN real model, reached
 * through THAT vendor's own public API with an operator-supplied key for
 * that vendor — You.com, DeepSeek, xAI/Grok, Meta AI, MiniMax. `modelName`
 * on a successful result is always the real model id the vendor billed the
 * call under (e.g. `"deepseek-v4-flash"`, `"grok-4.6"`), never a persona
 * label.
 *
 * A vendor with no configured operator key answers `status: "unavailable"`
 * for that model — never an error, never a crash, exactly like requesting
 * Ads-derived keyword data with no Google Ads account configured.
 */
export class DirectVendorAiResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Run a prompt against up to 5 real vendor models and see whether a brand
   * is mentioned in the answers.
   *
   * Resolves to `{ result }`, matching {@link AiSearchResource.promptExplorer}'s
   * own envelope shape:
   *
   * ```typescript
   * const { result } = await client.directVendorAi.answer({ ... });
   * ```
   */
  answer(
    input: DirectVendorAnswersInput,
    options?: RequestOptions,
  ): Promise<DirectVendorAnswersResponse> {
    return this.http.post<DirectVendorAnswersResponse>(
      "/ai/direct-vendor-answers",
      input,
      options,
    );
  }
}
