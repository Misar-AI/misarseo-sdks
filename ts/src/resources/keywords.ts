import type { HttpClient, RequestOptions } from "../http.js";
import type {
  KeywordGapInput,
  KeywordGapResult,
  KeywordPotential,
  KeywordPotentialInput,
  ListSavedKeywordsInput,
  ListSavedKeywordsResponse,
  ResearchKeywordsInput,
  ResearchKeywordsResponse,
  SaveKeywordsInput,
  SaveKeywordsResponse,
} from "../types.js";

/**
 * The saved-keyword list filters travel as comma-separated values, and the
 * route refuses a parameter that is present but holds nothing usable —
 * `?tagNames=` is a 400, never "no filter". So an empty array is sent as
 * nothing at all rather than as an empty string.
 */
function commaList(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

/**
 * Keywords resource — research, save, list, and compare keywords.
 */
export class KeywordsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Research keyword data (search volume, difficulty, CPC, related ideas)
   * for 1–100 seed keywords in one call.
   * Charges credits per seed (~30–100 credits each).
   *
   * Resolves to ONE flat `rows` array for the whole request — there is no
   * per-seed grouping on the wire. This used to be declared as
   * `{ results: [{ seed, ok, topRows }] }`, which is the in-app MCP tool's
   * envelope and not this route's; `response.results` was `undefined` on every
   * successful call. Issue one request per seed if you need the split.
   *
   * Read `keywordDifficultySource` before showing the difficulty column, and
   * `diagnostics` before concluding a thin result means a thin niche.
   */
  research(
    input: ResearchKeywordsInput,
    options?: RequestOptions,
  ): Promise<ResearchKeywordsResponse> {
    return this.http.post<ResearchKeywordsResponse>(
      "/keywords/research",
      input,
      options,
    );
  }

  /**
   * List keywords saved to a project, with cached metrics.
   * Free — reads from MisarSEO database, charges no credits.
   *
   * Sends `tagNames` and `pageSize`. It used to send `tags` and `limit`, which
   * this route does not read: both were dropped and the caller got an
   * unfiltered first page back with a 200, so a narrow that matched nothing
   * looked exactly like one that matched everything.
   *
   * The route splits its query between `restSavedKeywordsQuerySchema` (paging
   * and sorting) and `parseSavedKeywordFilters` (the ten value filters). That
   * split is a server-side implementation detail — every name below is read by
   * one or the other, and the contract test checks against both.
   */
  listSaved(
    input: ListSavedKeywordsInput,
    options?: RequestOptions,
  ): Promise<ListSavedKeywordsResponse> {
    return this.http.get<ListSavedKeywordsResponse>(
      "/keywords/saved",
      {
        projectId: input.projectId,
        search: input.search,
        page: input.page,
        pageSize: input.pageSize,
        sort: input.sort,
        order: input.order,
        tagNames: commaList(input.tagNames),
        tagIds: commaList(input.tagIds),
        includeTerms: commaList(input.includeTerms),
        excludeTerms: commaList(input.excludeTerms),
        minVolume: input.minVolume,
        maxVolume: input.maxVolume,
        minCpc: input.minCpc,
        maxCpc: input.maxCpc,
        minDifficulty: input.minDifficulty,
        maxDifficulty: input.maxDifficulty,
      },
      options,
    );
  }

  /**
   * Save keywords to a project's saved-keywords list.
   * Free — charges no credits. Idempotent, so it is safe to pass
   * `{ idempotent: true }` and let the SDK retry it like a GET.
   *
   * Tags are APPENDED. There is no `tagMode` here because the route has never
   * read one — see {@link SaveKeywordsInput}.
   */
  save(
    input: SaveKeywordsInput,
    options?: RequestOptions,
  ): Promise<SaveKeywordsResponse> {
    return this.http.post<SaveKeywordsResponse>(
      "/keywords/saved",
      input,
      options,
    );
  }

  /**
   * Get the Parent Topic and Traffic Potential of one keyword — the broader
   * term the currently-winning page ranks for, and the traffic that page pulls
   * in total.
   *
   * Charges credits: two upstream calls per cache miss (a live SERP, then the
   * ranked keywords of its top organic result), so this is a deliberate
   * per-keyword lookup rather than something to run over a result set.
   */
  potential(
    input: KeywordPotentialInput,
    options?: RequestOptions,
  ): Promise<KeywordPotential> {
    return this.http.get<KeywordPotential>(
      "/keywords/potential",
      {
        projectId: input.projectId,
        keyword: input.keyword,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
      },
      options,
    );
  }

  /**
   * Compare the project's own domain against up to 3 competitor domains and
   * classify every keyword a competitor ranks for as missing / behind / tied /
   * ahead / unknown.
   *
   * Charges credits: one ranked-keywords lookup per domain, so a comparison
   * costs up to FOUR upstream requests (your domain plus up to 3 competitors).
   * Each is cached 12h, so re-sorting or re-filtering the same comparison costs
   * nothing extra.
   *
   * Your own domain comes from the project row — there is no field for it, by
   * design. Read `unavailable` before `rows`, and keep `missing` (a provable
   * absence) distinct from `unknown` (the keyword fell below the fetched slice,
   * so nothing was measured either way).
   */
  gap(
    input: KeywordGapInput,
    options?: RequestOptions,
  ): Promise<KeywordGapResult> {
    return this.http.post<KeywordGapResult>("/keywords/gap", input, options);
  }
}
